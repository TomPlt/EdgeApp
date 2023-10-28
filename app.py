from flask import Flask, jsonify, request, render_template
import pandas as pd
import ast
import json
import networkx as nx
from networkx.readwrite import json_graph
import logging
logging.basicConfig(level=logging.INFO)
import sqlite3

DATABASE_FILE = 'edges.db'

def create_edges_table_if_not_exists():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Check if the 'edges' table exists
    cursor.execute('''SELECT count(name) FROM sqlite_master WHERE type='table' AND name='edges';''')
    table_exists = cursor.fetchone()[0] == 1

    if not table_exists:
        # Create the 'edges' table if it doesn't exist
        cursor.execute('''
            CREATE TABLE edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_node INTEGER,
                end_node INTEGER,
                name TEXT,
                graph_index INTEGER,
                FOREIGN KEY(start_node) REFERENCES nodes(id),
                FOREIGN KEY(end_node) REFERENCES nodes(id),
                FOREIGN KEY(graph_index) REFERENCES graphs(id)
            );
        ''')

    conn.commit()
    conn.close()

def save_to_database(edges, current_graph_index):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    create_edges_table_if_not_exists()

    # Convert the list of lists into a list of tuples
    edges_tuples = [(edge[0], edge[1]) for edge in edges]

    # Fetch the existing edges for the current graph index
    cursor.execute("SELECT start_node, end_node FROM edges WHERE graph_index = ?", (current_graph_index,))
    existing_edges = cursor.fetchall()
    existing_edges_set = set(existing_edges)

    df_train = pd.read_csv('../kilter/data/csvs/train.csv')
    df_nodes = pd.read_csv('../kilter/data/csvs/nodes.csv')
    
    for edge in edges_tuples:
        # Create or update the edge
        climb_name = get_climb_name(current_graph_index, df_climbs, df_train)

        # Using SQL's INSERT OR REPLACE to upsert
        cursor.execute("""
            INSERT OR REPLACE INTO edges (start_node, end_node, name, graph_index)
            VALUES (?, ?, ?, ?)
        """, (edge[0], edge[1], climb_name, current_graph_index))

    conn.commit()
    conn.close()

def get_edges_from_database(current_graph_index):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Fetch edges for the current graph_index
    cursor.execute("SELECT start_node, end_node FROM edges WHERE graph_index = ?", (current_graph_index,))
    edges_data = cursor.fetchall()

    conn.close()
    
    # Convert the fetched data into a list of tuples
    edges = [(edge[0], edge[1]) for edge in edges_data]

    return edges


def graphs_no_edges(index: int):
    df_train = pd.read_csv('../kilter/data/csvs/train.csv')
    df_nodes = pd.read_csv('../kilter/data/csvs/nodes.csv')
    row = df_train.loc[index]
    coordinates = ast.literal_eval(row['coordinates'])
    nodes = ast.literal_eval(row['nodes'])
    hold_variants = ast.literal_eval(row['hold_type'])
    coord_dict = {node_id: coord for node_id, coord in zip(nodes, coordinates)}

    G = nx.Graph()  # Initialize an empty (un-directed) graph
    
    # Adding nodes
    for i, node_id in enumerate(nodes):
        node_features = df_nodes.loc[node_id].to_dict()
        G.add_node(node_id, coordinates=coord_dict[node_id], hold_variant=hold_variants[i], **node_features)
    return G

def get_climb_name(index, df_climbs, df_train):
    return df_climbs.loc[df_climbs.uuid == df_train.uuid[index]]['name'].values[0]

def fetch_largest_graph_index_with_edges():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute("SELECT MAX(graph_index) FROM edges")
    largest_index = cursor.fetchone()[0]
    
    conn.close()
    
    return largest_index if largest_index is not None else 0


def get_links_climb(name, df_links):
    return str(df_links.loc[df_links.name == name]['links'].values).split(',')

app = Flask(__name__)

# Load data outside of routes to minimize overhead
df_climbs = pd.read_csv('../kilter/data/csvs/climbs.csv')
df_train = pd.read_csv('../kilter/data/csvs/train.csv')
df_nodes = pd.read_csv('../kilter/data/csvs/nodes.csv')
df_links = pd.read_csv('../kilter/data/csvs/grouped_instagram_links.csv')
current_graph_index = fetch_largest_graph_index_with_edges()

@app.route('/')
def index():
    return render_template('index.html')

from flask import jsonify

@app.route('/climbName/<int:index>', methods=['GET'])
def climbName(index):
    # Use the get_climb_name function to fetch the climb name for the given index
    climb_name = get_climb_name(index, df_climbs, df_train)
    climb_links = get_links_climb(climb_name, df_links)
    print(len(climb_links))
    
    # Combine climb name and links into a dictionary and return as JSON
    response = {
        'climb_name': climb_name,
        'links': climb_links
    }
    return jsonify(response)


@app.route('/graph', methods=['GET'])
def get_graph():
    global current_graph_index
    graph_data = graphs_no_edges(current_graph_index)
    nodes = [{"id": node, "data": data} for node, data in graph_data.nodes(data=True)]
    edges = [{"source": source, "target": target} for source, target in graph_data.edges()]
    return jsonify({"nodes": nodes, "edges": edges, "graph_index": current_graph_index})

# adding a route which increments the graph index
@app.route('/next', methods=['GET'])
def next_graph():
    global current_graph_index
    current_graph_index += 1
    return jsonify({"success": True})
# adding a route which decrements the graph index
@app.route('/previous', methods=['GET'])
def previous_graph():
    global current_graph_index
    current_graph_index -= 1
    return jsonify({"success": True})

@app.route('/getEdges', methods=['GET'])
def get_edges():
    global current_graph_index
    edges_data = get_edges_from_database(current_graph_index) # Implement a function to get edges from your database
    return jsonify({"edges": edges_data})

@app.route('/deleteAllEdges', methods=['DELETE'])
def delete_all_edges():
    try:
        global current_graph_index
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM edges WHERE graph_index = ?", (current_graph_index,))
        conn.commit()
        conn.close()
        return jsonify({"message": "All edges have been deleted"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    

@app.route('/saveEdges', methods=['POST'])
def save_edges():
    global current_graph_index
    edges = request.json
    logging.info(f"Received {(edges)}")
    logging.info(f"Received {len(edges)} edges")
    save_to_database(edges, current_graph_index)
    logging.info(f"Saved {len(edges)} edges to database")
    return jsonify(success=True)

if __name__ == '__main__':
    app.run(debug=True)
