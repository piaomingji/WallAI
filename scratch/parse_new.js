const fs = require('fs');
const html = fs.readFileSync('scratch/new_form.html', 'utf-8');
const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  const items = data[1][1];
  console.log('Google Form Items:');
  if (!items) {
    console.log('No items found in this form.');
    return;
  }
  items.forEach(item => {
    const title = item[1];
    const id = item[0];
    const entryId = item[4] && item[4][0] && item[4][0][0];
    console.log(`Title: ${title}, ID: ${id}, EntryID: entry.${entryId}`);
  });
} else {
  console.log('FB_PUBLIC_LOAD_DATA_ not found');
}
