import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppBrandLogo } from '@/components/shell/AppBrandLogo';
import { AppLegalFooter } from '@/components/shell/AppLegalFooter';
import {
  HeroMockupShell,
  LandingButton,
  PulseDot,
  Reveal,
} from '@/components/landing/LandingMotion';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE } from '@/lib/appBrand';
import { brandColors } from '@/lib/brandTokens';

const MAX_WIDTH = 1100;
const BREAKPOINT = 768;

/** Manual v1.0 — máx. 3 cores por peça: azul, verde, branco (+ laranja só alerta). */
const C = {
  primary: brandColors.primary,
  secondary: brandColors.secondary,
  white: brandColors.background,
  surface: brandColors.surface,
  text: brandColors.textBody,
  alert: brandColors.alert,
  primaryDeep: '#071830',
  primaryMid: '#0A2248',
} as const;

const AUDIENCES = [
  {
    icon: 'briefcase-outline' as const,
    title: 'Contadores',
    tagline: 'Mais MEI. Mais margem. Menos esforço.',
    desc: 'Escale sem contratar mais. Automação fiscal e receita recorrente previsível.',
  },
  {
    icon: 'school-outline' as const,
    title: 'Estudantes',
    tagline: 'Construa sua carteira antes de pegar o diploma.',
    desc: 'Atenda MEIs com ferramenta profissional enquanto ainda forma sua base.',
  },
  {
    icon: 'rocket-outline' as const,
    title: 'Empreendedores',
    tagline: 'Um negócio lucrativo começa onde outros param de olhar.',
    desc: 'Baixa barreira de entrada para montar operação sólida no mercado MEI.',
  },
];

function ProductMockup() {
  return (
    <View style={mock.wrap}>
      <View style={mock.phone}>
        <View style={mock.statusBar}>
          <Text style={mock.statusTime}>9:41</Text>
          <Ionicons name="cellular" size={11} color="rgba(255,255,255,0.45)" />
        </View>

        <Text style={mock.sectionLabel}>PAINEL MEI</Text>
        <Text style={mock.metric}>15</Text>
        <Text style={mock.metricHint}>notas emitidas este mês</Text>

        <View style={mock.statsRow}>
          <View style={[mock.statCard, { backgroundColor: 'rgba(0,168,107,0.14)' }]}>
            <Text style={[mock.statValue, { color: C.secondary }]}>Em dia</Text>
            <Text style={mock.statLabel}>DAS</Text>
          </View>
          <View style={[mock.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={mock.statValue}>72%</Text>
            <Text style={mock.statLabel}>limite MEI</Text>
          </View>
        </View>

        <View style={mock.waBubble}>
          <View style={mock.waHeader}>
            <Ionicons name="logo-whatsapp" size={14} color={C.secondary} />
            <Text style={mock.waTitle}>WhatsApp · áudio</Text>
          </View>
          <Text style={mock.waQuote}>
            "Emitir nota de consultoria, R$ 350, para João Silva."
          </Text>
          <Text style={mock.waStatus}>NFSe autorizada ✓</Text>
        </View>
      </View>
    </View>
  );
}

const mock = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 4,
  },
  phone: {
    width: 272,
    backgroundColor: C.primaryMid,
    borderRadius: 20,
    padding: 20,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusTime: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '400' },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  metric: {
    color: C.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 10, padding: 10 },
  statValue: { color: C.white, fontSize: 14, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, marginTop: 2, fontWeight: '400' },
  waBubble: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.28)',
    backgroundColor: 'rgba(0,168,107,0.08)',
    padding: 12,
    gap: 6,
  },
  waHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waTitle: { color: C.secondary, fontSize: 10, fontWeight: '800' },
  waQuote: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16, fontWeight: '400' },
  waStatus: { color: C.secondary, fontSize: 10, fontWeight: '800' },
});

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
}) {
  return (
    <View style={feat.card}>
      <View style={feat.iconBox}>
        <Ionicons name={icon} size={22} color={C.secondary} />
      </View>
      <Text style={feat.title}>{title}</Text>
      <Text style={feat.desc}>{desc}</Text>
    </View>
  );
}

const feat = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 240,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(13,43,94,0.08)',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: 'rgba(0,168,107,0.1)',
  },
  title: { fontSize: 17, fontWeight: '800', color: C.primary, marginBottom: 8 },
  desc: { fontSize: 14, color: C.text, lineHeight: 22, fontWeight: '400' },
});

function AudienceCard({
  icon,
  title,
  tagline,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  tagline: string;
  desc: string;
}) {
  return (
    <View style={aud.card}>
      <Ionicons name={icon} size={22} color={C.secondary} />
      <Text style={aud.title}>{title}</Text>
      <Text style={aud.tagline}>{tagline}</Text>
      <Text style={aud.desc}>{desc}</Text>
    </View>
  );
}

const aud = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 260,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(13,43,94,0.08)',
    gap: 10,
  },
  title: { fontSize: 13, fontWeight: '800', color: C.secondary, letterSpacing: 0.5 },
  tagline: { fontSize: 16, fontWeight: '800', color: C.primary, lineHeight: 22 },
  desc: { fontSize: 14, color: C.text, lineHeight: 21, fontWeight: '400' },
});

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  const cx = {
    maxWidth: MAX_WIDTH,
    width: '100%' as const,
    alignSelf: 'center' as const,
    paddingHorizontal: isMobile ? 20 : 48,
  };

  const goLogin = () => router.push('/(auth)/login');
  const goRequestAccess = () => router.push('/(auth)/solicitar-acesso');

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Nav */}
      <View style={s.nav}>
        <View style={[s.navRow, cx]}>
          <Reveal delay={0} offset={12}>
            <AppBrandLogo variant="wordmark" onDarkBackground />
          </Reveal>

          <View style={[s.navActions, isMobile && s.navActionsMobile]}>
            <LandingButton
              label="Entrar"
              variant="ghost"
              compact={isMobile}
              entranceDelay={80}
              onPress={goLogin}
            />
            <LandingButton
              label={isMobile ? 'Solicitar' : 'Solicitar acesso'}
              variant="primary"
              compact={isMobile}
              entranceDelay={160}
              onPress={goRequestAccess}
            />
          </View>
        </View>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <View style={[s.heroInner, cx, isMobile && s.heroInnerMobile]}>
          <View style={s.heroCopy}>
            <Reveal delay={120}>
              <View style={s.pill}>
                <PulseDot />
                <Text style={s.pillText}>Tecnologia para quem atende MEI</Text>
              </View>
            </Reveal>

            <Reveal delay={220}>
              <Text style={[s.h1, isMobile && s.h1Mobile]}>
                O MEI sempre foi lucrativo.{'\n'}Agora você vai provar.
              </Text>
            </Reveal>

            <Reveal delay={320}>
              <Text style={s.heroSub}>{APP_BRAND_TAGLINE}</Text>
            </Reveal>

            <Reveal delay={420}>
              <Text style={s.heroBody}>
                Automação de DAS e nota fiscal — inclusive por áudio no WhatsApp.
                Receita recorrente, previsível e escalável para quem leva o MEI a sério.
              </Text>
            </Reveal>
          </View>

          {!isMobile ? (
            <HeroMockupShell style={s.heroVisual}>
              <ProductMockup />
            </HeroMockupShell>
          ) : null}
        </View>
      </View>

      {/* Métricas — manual */}
      <View style={s.strip}>
        <View style={[cx, s.stripRow, isMobile && s.stripRowMobile]}>
          {[
            { n: '15M+', label: 'CNPJs MEI no Brasil' },
            { n: '70%', label: 'de todas as empresas' },
            { n: '1ª', label: 'NF por áudio no WhatsApp' },
          ].map((item, index) => (
            <Reveal key={item.label} delay={120 + index * 100} style={s.stripItem}>
              <Text style={s.stripN}>{item.n}</Text>
              <Text style={s.stripLabel}>{item.label}</Text>
            </Reveal>
          ))}
        </View>
      </View>

      {/* Públicos */}
      <View style={s.section}>
        <View style={cx}>
          <Reveal delay={80}>
            <Text style={s.eyebrow}>PARA QUEM</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              Quem transforma MEI{'\n'}em negócio lucrativo
            </Text>
          </Reveal>
          <View style={[s.grid, isMobile && s.gridMobile]}>
            {AUDIENCES.map((a, index) => (
              <Reveal key={a.title} delay={160 + index * 90} style={s.gridReveal}>
                <AudienceCard {...a} />
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* Diferencial */}
      <View style={[s.section, s.sectionTint]}>
        <View style={[cx, s.diffRow, isMobile && s.diffRowMobile]}>
          <Reveal delay={100} style={s.diffCopy}>
            <Text style={s.eyebrow}>DIFERENCIAL</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              Nota fiscal por áudio.{'\n'}Só no {APP_BRAND_NAME}.
            </Text>
            <Text style={s.diffBody}>
              O MEI manda um áudio no WhatsApp. O sistema emite a nota.
              Não existe nada igual no mercado hoje — foco, tecnologia e movimento
              na prática do dia a dia.
            </Text>
          </Reveal>
          <Reveal delay={220} style={s.diffHighlight}>
            <Ionicons name="mic-outline" size={28} color={C.secondary} />
            <Text style={s.diffHighlightText}>
              DAS + NFSe integrados à rotina do cliente, sem planilha e sem fricção.
            </Text>
          </Reveal>
        </View>
      </View>

      {/* Funcionalidades */}
      <View style={s.section}>
        <View style={cx}>
          <Reveal delay={80}>
            <Text style={s.eyebrow}>O QUE ENTREGAMOS</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              O sistema cuida do MEI.{'\n'}Você cuida do lucro.
            </Text>
          </Reveal>
          <View style={[s.grid, isMobile && s.gridMobile]}>
            {[
              {
                icon: 'logo-whatsapp' as const,
                title: 'NFSe por WhatsApp',
                desc: 'Emissão por áudio — o diferencial que nenhuma outra plataforma oferece.',
              },
              {
                icon: 'receipt-outline' as const,
                title: 'DAS e obrigações',
                desc: 'Guias, parcelamentos e acompanhamento fiscal sem depender de planilha.',
              },
              {
                icon: 'document-text-outline' as const,
                title: 'Painel web completo',
                desc: 'Catálogo, certificado digital, limites de faturamento e histórico de notas.',
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={160 + index * 90} style={s.gridReveal}>
                <FeatureCard {...item} />
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* CTA */}
      <View style={s.cta}>
        <View style={[cx, s.ctaInner]}>
          <Reveal delay={100}>
            <Text style={[s.ctaTitle, isMobile && s.h2Mobile]}>
              Mais MEI. Mais margem. Menos esforço.
            </Text>
            <Text style={s.ctaSub}>
              Plataforma de tecnologia e estratégia para contadores, estudantes e empreendedores
              que querem escalar com governança e resultados documentados.
            </Text>
          </Reveal>
          <View style={[s.ctaBtns, isMobile && s.ctaBtnsMobile]}>
            <LandingButton
              label="Entrar"
              variant="primary"
              entranceDelay={220}
              onPress={goLogin}
            />
            <LandingButton
              label="Solicitar acesso"
              variant="ghost"
              entranceDelay={300}
              onPress={goRequestAccess}
            />
          </View>
        </View>
      </View>

      {/* Footer */}
      <AppLegalFooter />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  content: { flexGrow: 1 },

  nav: {
    backgroundColor: C.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  navActionsMobile: { gap: 8 },

  hero: { backgroundColor: C.primary, paddingVertical: 64 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  heroInnerMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  heroCopy: { flex: 1, maxWidth: 560 },
  heroVisual: { flexShrink: 0, alignSelf: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(0,168,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.28)',
  },
  pillText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '400' },
  h1: {
    fontSize: 44,
    fontWeight: '800',
    color: C.white,
    lineHeight: 52,
    letterSpacing: -1,
    marginBottom: 16,
  },
  h1Mobile: { fontSize: 32, lineHeight: 40 },
  heroSub: {
    fontSize: 18,
    fontWeight: '800',
    color: C.secondary,
    lineHeight: 26,
    marginBottom: 12,
  },
  heroBody: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 480,
  },

  strip: {
    backgroundColor: C.primaryMid,
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stripRowMobile: { flexDirection: 'column', gap: 24, alignItems: 'center' },
  stripItem: { alignItems: 'center', gap: 4 },
  stripN: { fontSize: 28, fontWeight: '800', color: C.secondary },
  stripLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '400', textAlign: 'center' },

  section: { paddingVertical: 72, backgroundColor: C.white },
  sectionTint: { backgroundColor: C.surface },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: C.secondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  h2: {
    fontSize: 32,
    fontWeight: '800',
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -0.4,
    marginBottom: 40,
  },
  h2Mobile: { fontSize: 26, lineHeight: 34 },
  grid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  gridMobile: { flexDirection: 'column' },
  gridReveal: { flex: 1, minWidth: 240 },

  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  diffRowMobile: { flexDirection: 'column' },
  diffCopy: { flex: 1 },
  diffBody: { fontSize: 15, color: C.text, lineHeight: 24, fontWeight: '400', maxWidth: 520 },
  diffHighlight: {
    flex: 1,
    minWidth: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.22)',
    backgroundColor: 'rgba(0,168,107,0.08)',
    padding: 24,
    gap: 12,
  },
  diffHighlightText: { fontSize: 15, color: C.primary, lineHeight: 22, fontWeight: '400' },

  cta: { backgroundColor: C.primary, paddingVertical: 72 },
  ctaInner: { alignItems: 'center' },
  ctaTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  ctaSub: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 560,
  },
  ctaBtns: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  ctaBtnsMobile: { flexDirection: 'column', width: '100%', maxWidth: 320, alignItems: 'stretch' },
});
