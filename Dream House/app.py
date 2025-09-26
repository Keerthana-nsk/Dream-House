from flask import Flask, render_template, request, jsonify, send_file, g
import re
import json
import os
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'data', 'designs.db')

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Ensure data folder exists
os.makedirs(os.path.join(BASE_DIR, 'data'), exist_ok=True)

# Simple DB helpers
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS designs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            prompt TEXT,
            data TEXT,
            created_at TEXT
        )
    ''')
    db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Very simple prompt parser: extracts numbers and keywords from free text
def parse_prompt(prompt_text):
    text = prompt_text.lower()
    # Numbers: search for patterns like '2 bhk', '3 bedrooms' or standalone numbers
    bedrooms = 0
    bathrooms = 0
    kitchens = 0
    halls = 0

    # look for X bhk or X bedroom(s)
    m = re.search(r"(\d+)\s*bhk", text)
    if m:
        bedrooms = int(m.group(1))
    else:
        m = re.search(r"(\d+)\s*bed(room)?s?", text)
        if m:
            bedrooms = int(m.group(1))

    m = re.search(r"(\d+)\s*bath(room)?s?", text)
    if m:
        bathrooms = int(m.group(1))
    else:
        # sometimes like '2 bathrooms' or '2 bath'
        m = re.search(r"(\d+)\s*bath", text)
        if m:
            bathrooms = int(m.group(1))

    m = re.search(r"(\d+)\s*kitchen(s)?", text)
    if m:
        kitchens = int(m.group(1))
    else:
        if 'kitchen' in text:
            kitchens = 1

    if 'hall' in text or 'living' in text:
        halls = 1

    # fallback defaults if zero
    if bedrooms == 0 and 'studio' in text:
        bedrooms = 1
    if bedrooms == 0:
        # try to find any standalone number as bedrooms if context suggests
        m = re.search(r"(\d+)[^\d]*(bed|room|bhk)", text)
        if m:
            bedrooms = int(m.group(1))

    # style detection
    style = 'modern'
    if 'traditional' in text:
        style = 'traditional'
    elif 'minimal' in text or 'minimalist' in text:
        style = 'minimal'
    elif 'modern' in text:
        style = 'modern'

    # extras
    balcony = 'balcony' in text
    garden = 'garden' in text
    parking = 'parking' in text or 'garage' in text

    return {
        'bedrooms': bedrooms,
        'bathrooms': bathrooms,
        'kitchens': kitchens,
        'halls': halls,
        'style': style,
        'balcony': balcony,
        'garden': garden,
        'parking': parking
    }

# convert parsed data into a simple layout model
def make_layout(parsed, project_name='My Dream House'):
    # produce a list of rooms (type, id, width, height)
    rooms = []
    for i in range(parsed['bedrooms'] if parsed['bedrooms']>0 else 1):
        rooms.append({'type':'Bedroom','id':f'Bed{i+1}','w':4,'h':3})
    for i in range(parsed['bathrooms']):
        rooms.append({'type':'Bathroom','id':f'Bath{i+1}','w':2,'h':2})
    for i in range(parsed['kitchens'] if parsed['kitchens']>0 else 1):
        rooms.append({'type':'Kitchen','id':f'Kit{i+1}','w':3,'h':3})
    for i in range(parsed['halls'] if parsed['halls']>0 else 1):
        rooms.append({'type':'Hall','id':f'Hall{i+1}','w':4,'h':4})

    extras = []
    if parsed['balcony']:
        extras.append({'type':'Balcony','id':'Balcony1','w':2,'h':1})
    if parsed['garden']:
        extras.append({'type':'Garden','id':'Garden1','w':4,'h':3})
    if parsed['parking']:
        extras.append({'type':'Parking','id':'Parking1','w':4,'h':3})

    layout = {
        'name': project_name,
        'rooms': rooms,
        'extras': extras,
        'style': parsed['style']
    }
    return layout

@app.route('/')
def index():
    init_db()
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def api_generate():
    body = request.get_json() or {}
    prompt = body.get('prompt','')
    name = body.get('name','My Dream House')
    parsed = parse_prompt(prompt)
    layout = make_layout(parsed, project_name=name)
    return jsonify({'ok':True, 'layout': layout, 'parsed': parsed})

@app.route('/api/save', methods=['POST'])
def api_save():
    body = request.get_json() or {}
    name = body.get('name','My Dream House')
    prompt = body.get('prompt','')
    layout = body.get('layout', {})
    db = get_db()
    db.execute('INSERT INTO designs (name, prompt, data, created_at) VALUES (?,?,?,?)',
               (name, prompt, json.dumps(layout), datetime.utcnow().isoformat()))
    db.commit()
    return jsonify({'ok':True})

@app.route('/api/list', methods=['GET'])
def api_list():
    db = get_db()
    cur = db.execute('SELECT id, name, prompt, data, created_at FROM designs ORDER BY id DESC')
    rows = [dict(r) for r in cur.fetchall()]
    return jsonify({'ok':True, 'designs': rows})

@app.route('/api/get/<int:design_id>', methods=['GET'])
def api_get(design_id):
    db = get_db()
    cur = db.execute('SELECT id, name, prompt, data, created_at FROM designs WHERE id=?', (design_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({'ok':False, 'error':'Not found'}), 404
    row = dict(row)
    row['data'] = json.loads(row['data']) if row['data'] else {}
    return jsonify({'ok':True, 'design': row})

if __name__ == '__main__':
    app.run(debug=True)