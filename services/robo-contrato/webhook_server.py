#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor webhook 24h — recebe POST do FocoMEI após pagamento Stripe
e gera o contrato no Onety automaticamente.

Uso local:
  cd "robo contrato"
  python webhook_server.py

Configure no EasyPanel (backend FocoMEI):
  ONETY_CONTRATO_WEBHOOK_URL=http://SEU-IP:8787/webhook/contrato
  ONETY_CONTRATO_WEBHOOK_SECRET=mesmo_token_do_config.env
"""

from __future__ import annotations

import json
import logging
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
ENTRADA = ROOT / "entrada"

# Importa lógica existente do robô (sem duplicar)
from gerar_contrato import (
    OnetyClient,
    autenticar,
    extrair_specs,
    processar_spec,
    resolver_config,
)
from padrao_lote import carregar_padrao, expandir_lista

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("webhook-contrato")

_client_lock = threading.Lock()
_onety_client: OnetyClient | None = None
_onety_usuario: dict[str, Any] | None = None
_padrao: dict[str, Any] | None = None
_webhook_secret: str = ""


def carregar_webhook_secret(cfg: dict[str, Any]) -> str:
    import os

    from_file = ""
    env_path = ROOT / "config.env"
    if env_path.exists():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line.startswith("WEBHOOK_SECRET="):
                from_file = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

    return (
        os.environ.get("WEBHOOK_SECRET")
        or os.environ.get("ONETY_CONTRATO_WEBHOOK_SECRET")
        or from_file
    ).strip()


def get_client() -> tuple[OnetyClient, dict[str, Any], dict[str, Any]]:
    global _onety_client, _onety_usuario, _padrao
    with _client_lock:
        if _onety_client is None:
            cfg = resolver_config()
            _padrao = carregar_padrao(ENTRADA)
            client = OnetyClient(
                cfg["api_url"],
                token=cfg.get("token") or None,
                empresa_id=cfg.get("empresa_id"),
            )
            usuario = autenticar(client, cfg)
            _onety_client = client
            _onety_usuario = usuario
            log.info("Onety autenticado — empresa %s", cfg.get("empresa_id"))
        return _onety_client, _onety_usuario or {}, _padrao or {}


def validar_auth(header_value: str | None) -> bool:
    if not _webhook_secret:
        return True
    if not header_value:
        return False
    parts = header_value.split(" ", 1)
    token = parts[1].strip() if len(parts) == 2 and parts[0].lower() == "bearer" else header_value.strip()
    return token == _webhook_secret


def processar_payload_focomei(body: dict[str, Any]) -> dict[str, Any]:
    cfg = resolver_config()
    client, usuario, padrao = get_client()
    specs_raw = extrair_specs(body)
    if not specs_raw:
        return {"ok": False, "error": "Nenhum contrato no JSON (esperado { contratos: [...] })"}

    specs = expandir_lista(specs_raw, padrao)
    resultados: list[dict[str, Any]] = []
    ok_count = 0

    for i, spec in enumerate(specs, 1):
        razao = (
            spec.get("razao_social")
            or (spec.get("cliente") or {}).get("nome")
            or f"contrato_{i}"
        )
        rotulo = str(razao).replace(" ", "_")[:60]
        log.info("Gerando contrato %s/%s: %s", i, len(specs), rotulo)
        sucesso, msg = processar_spec(
            client,
            cfg,
            spec,
            rotulo=rotulo,
            dry_run=False,
            pdf_arg=None,
            usuario=usuario,
            force=False,
        )
        if sucesso:
            ok_count += 1
        resultados.append({"rotulo": rotulo, "ok": sucesso, "mensagem": msg})

    return {
        "ok": ok_count == len(specs),
        "total": len(specs),
        "sucesso": ok_count,
        "falhas": len(specs) - ok_count,
        "resultados": resultados,
    }


class WebhookHandler(BaseHTTPRequestHandler):
    server_version = "RoboContratoWebhook/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        log.info("%s - %s", self.address_string(), fmt % args)

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/health", "/healthz"):
            self._send_json(HTTPStatus.OK, {"ok": True, "service": "robo-contrato-webhook"})
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in ("/webhook/contrato", "/webhook/contrato/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return

        if not validar_auth(self.headers.get("Authorization")):
            self._send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "unauthorized"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "body_vazio"})
            return

        try:
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._send_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": f"json_invalido: {exc}"},
            )
            return

        if not isinstance(body, dict):
            self._send_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "esperado objeto JSON"},
            )
            return

        try:
            resultado = processar_payload_focomei(body)
            status = HTTPStatus.OK if resultado.get("ok") else HTTPStatus.UNPROCESSABLE_ENTITY
            self._send_json(status, resultado)
        except Exception as exc:
            log.exception("Erro ao processar webhook")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "error": str(exc)},
            )


def main() -> int:
    global _webhook_secret
    cfg = resolver_config()
    _webhook_secret = carregar_webhook_secret(cfg)

    import os

    host = (os.environ.get("WEBHOOK_HOST") or "0.0.0.0").strip()
    port = int(os.environ.get("WEBHOOK_PORT") or "8787")

    log.info("Pré-autenticando no Onety...")
    try:
        get_client()
    except Exception as exc:
        log.error("Falha ao autenticar no Onety: %s", exc)
        return 1

    httpd = ThreadingHTTPServer((host, port), WebhookHandler)
    log.info("Webhook ouvindo em http://%s:%s/webhook/contrato", host, port)
    if _webhook_secret:
        log.info("Autenticação Bearer ativa (WEBHOOK_SECRET)")
    else:
        log.warning("WEBHOOK_SECRET não definido — endpoint aberto (use só em rede interna)")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("Encerrado pelo usuário")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
