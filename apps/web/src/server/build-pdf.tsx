import 'server-only';
import path from 'node:path';
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { Severity } from '@redcore/domain';

// Полный Inter (кириллица, латиница, узбекская ʻ U+02BB, неразрывные пробелы в ценах).
// Встроенные шрифты PDF кириллицу не умеют, поэтому шрифт обязателен.
const fontsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'assets', 'fonts');
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter-Regular.woff'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Inter-SemiBold.woff'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Inter-Bold.woff'), fontWeight: 700 },
  ],
});
// Переносы по слогам ломают названия моделей — переносим только по пробелам
Font.registerHyphenationCallback((word) => [word]);

const BRAND = 'RedCore';
const RED = '#D40000';
const severityColor: Record<Severity, string> = {
  error: '#D92D20',
  warning: '#B54708',
  info: '#1D4ED8',
};

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: '#18181B', padding: 36, paddingBottom: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: RED,
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  brandAccent: { color: RED },
  muted: { color: '#71717A' },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  table: { borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 4, marginTop: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E4E4E7' },
  headRow: { backgroundColor: '#F4F4F5' },
  cell: { paddingVertical: 6, paddingHorizontal: 8 },
  colSlot: { width: '19%' },
  colItem: { width: '37%' },
  colQty: { width: '8%', textAlign: 'right' },
  colPrice: { width: '18%', textAlign: 'right' },
  colSum: { width: '18%', textAlign: 'right' },
  bold: { fontWeight: 600 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  total: { fontSize: 13, fontWeight: 700 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 600, marginBottom: 6 },
  issue: { flexDirection: 'row', marginBottom: 4 },
  issueMark: { width: 10, fontWeight: 700 },
  footer: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 24,
    fontSize: 7.5,
    color: '#71717A',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    paddingTop: 6,
  },
});

export interface BuildPdfData {
  /** BCP-47 язык документа: ru или uz-Latn */
  lang: string;
  title: string;
  subtitle: string;
  generated: string;
  columns: { slot: string; item: string; qty: string; price: string; sum: string };
  lines: { slot: string; name: string; sku: string; qty: number; price: string; sum: string }[];
  totalLabel: string;
  total: string;
  statusLabel: string;
  status: string;
  issues: { severity: Severity; text: string }[];
  power: string;
  link: string;
  disclaimer: string;
}

function BuildPdf({ data }: { data: BuildPdfData }) {
  return (
    <Document title={data.title} author={BRAND} creator={BRAND} language={data.lang}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>
            <Text style={s.brandAccent}>RED</Text>CORE
          </Text>
          <Text style={s.muted}>{data.generated}</Text>
        </View>

        <Text style={s.title}>{data.title}</Text>
        <Text style={s.muted}>{data.subtitle}</Text>

        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            <Text style={[s.cell, s.colSlot, s.bold]}>{data.columns.slot}</Text>
            <Text style={[s.cell, s.colItem, s.bold]}>{data.columns.item}</Text>
            <Text style={[s.cell, s.colQty, s.bold]}>{data.columns.qty}</Text>
            <Text style={[s.cell, s.colPrice, s.bold]}>{data.columns.price}</Text>
            <Text style={[s.cell, s.colSum, s.bold]}>{data.columns.sum}</Text>
          </View>
          {data.lines.map((line) => (
            <View key={line.sku} style={s.row} wrap={false}>
              <Text style={[s.cell, s.colSlot, s.muted]}>{line.slot}</Text>
              <View style={[s.cell, s.colItem]}>
                <Text>{line.name}</Text>
                <Text style={[s.muted, { fontSize: 7 }]}>{line.sku}</Text>
              </View>
              <Text style={[s.cell, s.colQty]}>{String(line.qty)}</Text>
              <Text style={[s.cell, s.colPrice]}>{line.price}</Text>
              <Text style={[s.cell, s.colSum, s.bold]}>{line.sum}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.total}>{data.totalLabel}</Text>
            <Text style={[s.total, s.brandAccent]}>{data.total}</Text>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{`${data.statusLabel}: ${data.status}`}</Text>
          {data.issues.map((issue, i) => (
            <View key={i} style={s.issue}>
              <Text style={[s.issueMark, { color: severityColor[issue.severity] }]}>•</Text>
              <Text style={{ flex: 1 }}>{issue.text}</Text>
            </View>
          ))}
          <Text style={[s.muted, { marginTop: 6 }]}>{data.power}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>{data.link}</Text>
          <Text>{data.disclaimer}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderBuildPdf(data: BuildPdfData): Promise<Buffer> {
  return renderToBuffer(<BuildPdf data={data} />);
}
