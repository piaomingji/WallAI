const fs = require('fs');
const html = fs.readFileSync('scratch/form.html', 'utf-8');
const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  // Googleフォームの項目定義を解析する
  // data[1][1] に各設問のデータが入っている
  const items = data[1][1];
  console.log('Google Form Items:');
  items.forEach(item => {
    const title = item[1];
    const id = item[0];
    const entryId = item[4] && item[4][0] && item[4][0][0];
    console.log(`Title: ${title}, ID: ${id}, EntryID: entry.${entryId}`);
    if (item[4] && item[4][0] && item[4][0][1]) {
      console.log('  Choices:', item[4][0][1].map(c => c[0]));
    }
  });
} else {
  console.log('FB_PUBLIC_LOAD_DATA_ not found');
}
