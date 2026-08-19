from pathlib import Path

css_path = Path('/home/ubuntu/personal-ai-venture-os/client/src/index.css')
text = css_path.read_text()
replacements = {
    '#d89a3a': '#000', '#a16c20': '#000', '#fbefd9': '#fff', '#ede8f7': '#fff',
    '#e5eef9': '#fff', '#6d5a9b': '#000', '#edf0f2': '#fff', '#9b681e': '#000',
    '#94651f': '#000', '#687382': '#000', '#346ca5': '#000', '#263957': '#000',
    '#e4f1e9': '#fff', '#b9a47f': '#000', '#3e8062': '#000', '#fffbf1': '#fff',
    '#fff9ed': '#fff', '#f7f1e7': '#fff', '#f4dfbc': '#fff', '#eff1ed': '#fff',
    '#e7d8b9': '#fff', '#806e57': '#000', '#5c9a75': '#000', '#4979a7': '#000',
    '#46a876': '#000', '#2e66a2': '#000', '#1f304e': '#000',
    'rgba(36,50,74,.025)': 'rgba(0,0,0,.025)', 'rgba(70,168,118,.12)': 'rgba(0,0,0,.12)',
    'rgba(38,57,87,.2)': 'rgba(0,0,0,.2)', 'rgba(38,57,87,.18)': 'rgba(0,0,0,.18)',
    'rgba(38,57,87,.17)': 'rgba(0,0,0,.17)', 'rgba(38,57,87,.16)': 'rgba(0,0,0,.16)',
    'rgba(38,57,87,.13)': 'rgba(0,0,0,.13)', 'rgba(30,41,59,.35)': 'rgba(0,0,0,.35)',
    'rgba(30,41,59,.24)': 'rgba(0,0,0,.24)', 'rgba(30,41,59,.12)': 'rgba(0,0,0,.12)',
    'rgba(216,154,58,.16)': 'rgba(0,0,0,.16)', 'rgba(216,154,58,.13)': 'rgba(0,0,0,.13)',
    'rgba(216,154,58,.09)': 'rgba(0,0,0,.09)',
}
for old, new in replacements.items():
    text = text.replace(old, new)
css_path.write_text(text)
