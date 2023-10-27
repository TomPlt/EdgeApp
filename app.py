from flask import Flask, jsonify, request, render_template
import pandas as pd
import ast
import json
import networkx as nx
from networkx.readwrite import json_graph


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


app = Flask(__name__)

# Load data outside of routes to minimize overhead
df_climbs = pd.read_csv('../kilter/data/csvs/climbs.csv')
df_train = pd.read_csv('../kilter/data/csvs/train.csv')
df_nodes = pd.read_csv('../kilter/data/csvs/nodes.csv')
current_graph_index = 0
print(df_climbs.head())
name = df_climbs.loc[df_climbs.uuid == df_train.uuid[current_graph_index]]['name']
print(name)
# other functions remain the same...

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/graph', methods=['GET'])
def get_graph():
    global current_graph_index
    graph_data = graphs_no_edges(current_graph_index)
    nodes = [{"id": node, "data": data} for node, data in graph_data.nodes(data=True)]
    edges = [{"source": source, "target": target} for source, target in graph_data.edges()]
    return jsonify({"nodes": nodes, "edges": edges})

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

app.post('/saveEdges', (req, res) => {
   const edges = req.body;
   // Save edges to the database
   // ... (database logic here)

   // Send a success or error response
   if(/* edges saved successfully */) {
       res.json({ success: true });
   } else {
       res.json({ success: false });
   }
});

if __name__ == '__main__':
    app.run(debug=True)
