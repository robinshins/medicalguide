// One-shot backfill: rebuilds articles-index/{category}-{lang} documents from
// the existing collections. Collection → category mapping is authoritative:
//   articles       → dental
//   articles_derma → dermatology
// This mirrors how pages read data (getCollection() in src/lib/articles.ts) and
// keeps out any cross-site contamination in the shared Firebase project.
//
// Usage: node rebuild-articles-index.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8')
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const INDEX_COLLECTION = 'articles-index';
const MAX_ITEMS_PER_INDEX = 500;
const COLLECTIONS = [
  { name: 'articles', category: 'dental' },
  { name: 'articles_derma', category: 'dermatology' },
];

function summaryFrom(doc, enforcedCategory) {
  return {
    id: doc.id,
    slug: doc.slug,
    category: enforcedCategory,
    lang: doc.lang,
    title: doc.title,
    metaDescription: doc.metaDescription,
    publishedAt: doc.publishedAt,
    region: doc.region,
    specialty: doc.specialty,
  };
}

async function rebuildFromCollection({ name, category }) {
  console.log(`\n[Rebuild] Scanning ${name} (category=${category})...`);
  const byLang = new Map();
  const snap = await db.collection(name).select(
    'id', 'slug', 'category', 'lang', 'title', 'metaDescription',
    'publishedAt', 'region', 'specialty'
  ).get();
  console.log(`  Read ${snap.size} docs`);
  snap.docs.forEach(d => {
    const data = d.data();
    if (!data.lang) return;
    // Collection is authoritative for category — filter out docs whose category
    // field disagrees with the collection (cross-site contamination).
    if (data.category && data.category !== category) return;
    const list = byLang.get(data.lang) || [];
    list.push(summaryFrom(data, category));
    byLang.set(data.lang, list);
  });
  return byLang;
}

async function writeIndexDoc(category, lang, items) {
  items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const capped = items.slice(0, MAX_ITEMS_PER_INDEX);
  const id = `${category}-${lang}`;
  await db.collection(INDEX_COLLECTION).doc(id).set({
    category,
    lang,
    items: capped,
    updatedAt: new Date().toISOString(),
  });
  console.log(`  ${id}: ${items.length} total → wrote ${capped.length}`);
}

async function deleteIndexDoc(id) {
  await db.collection(INDEX_COLLECTION).doc(id).delete();
  console.log(`  deleted ${id}`);
}

async function main() {
  console.log('[Rebuild] Clearing existing index docs...');
  const existing = await db.collection(INDEX_COLLECTION).get();
  for (const d of existing.docs) await deleteIndexDoc(d.id);

  for (const col of COLLECTIONS) {
    const byLang = await rebuildFromCollection(col);
    console.log(`\n[Rebuild] Writing ${byLang.size} index docs for ${col.category}...`);
    for (const [lang, items] of byLang) {
      await writeIndexDoc(col.category, lang, items);
    }
  }
  console.log('\n[Rebuild] Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
