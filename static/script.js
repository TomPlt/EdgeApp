const svgWidth = 800;
const svgHeight = 800;

const xScale = d3.scaleLinear()
    .domain([0, 144])
    .range([0, svgWidth]);

const yScale = d3.scaleLinear()
    .domain([0, 156])
    .range([svgHeight, 0]);

const drag = d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);

let isConnectMode = false;

let graphData;
let edges = [];
let current_graph_index = 0;

// Define the arrowhead marker in the SVG defs section
const svg = d3.select("svg");
svg.append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("refX", 6) // x-coordinate at the tip of the arrow
    .attr("refY", 3) // y-coordinate at the tip of the arrow
    .attr("markerWidth", 10) // marker width
    .attr("markerHeight", 6) // marker height
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L0,6 L9,3 z") // Arrowhead path
    .style("fill", "black"); // Arrowhead color

document.getElementById("toggleConnectMode").addEventListener('click', () => {
    isConnectMode = !isConnectMode;
    console.log("Connect mode: " + isConnectMode);
    if (isConnectMode) {
        d3.selectAll("circle").call(drag);
    } else {
        d3.selectAll("circle").on('.drag', null);
    }
});
document.getElementById("clearEdgesButton").addEventListener('click', () => {
    clearEdges();
    fetch('/deleteAllEdges', {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
});

function clearEdges() {
    edges = []; // Clear the edges array
    d3.selectAll("line").remove(); // Remove all edge lines
}

let line = null;
let sourceNode = null;

function dragstarted(d) {
    if (!isConnectMode) return;

    sourceNode = d;

    const startingX = xScale(d.data.coordinates[0]);
    const startingY = yScale(d.data.coordinates[1]);

    line = d3.select("svg").append("line")
        .attr("x1", startingX)
        .attr("y1", startingY)
        .attr("x2", startingX)
        .attr("y2", startingY)
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)"); // Add arrowhead marker
}

function dragged(d) {
    if (!line) return;
    line.attr("x2", d3.event.x)
        .attr("y2", d3.event.y);
}

function dragended(d) {
    if (!line || !sourceNode) return;

    // Use graphData instead of data
    const targetNode = graphData.nodes.find(n => {
        return Math.sqrt((xScale(n.data.coordinates[0]) - d3.event.x) ** 2 + (yScale(n.data.coordinates[1]) - d3.event.y) ** 2) < 10;
    });

    if (targetNode && targetNode !== sourceNode) {
        edges.push([sourceNode.id, targetNode.id]);
        d3.select("svg").append("line")
            .attr("x1", xScale(sourceNode.data.coordinates[0]))
            .attr("y1", yScale(sourceNode.data.coordinates[1]))
            .attr("x2", xScale(targetNode.data.coordinates[0]))
            .attr("y2", yScale(targetNode.data.coordinates[1]))
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrowhead)"); // Add arrowhead marker
    }

    line.remove();
    line = null;
    sourceNode = null;
}

function fetchEdgesData() {
    fetch('/getEdges')
        .then(response => response.json())
        .then(data => {
            // Transform the data to match the expected format
            const transformedEdges = data.edges.map(edge => ({
                source: edge[0], // Extract source from the tuple
                target: edge[1]  // Extract target from the tuple
            }));

            // Call the function to display edges with the transformed data
            displayEdges(transformedEdges);
        });
};

function fetchGraphData() {
    // Clear the edges array and remove existing edge lines
    // clearEdges();

    fetch('/graph')
        .then(response => response.json())
        .then(data => {
            graphData = data;
            drawGraph(data);
            fetchEdgesData();
            displayEdges(graphData.edges);
            current_graph_index = data.graph_index;
            fetchClimbName(current_graph_index);
        });
}

function fetchClimbName(current_graph_index) {
    fetch('/climbName/' + current_graph_index)
        .then(response => response.json())
        .then(data => {
            document.getElementById("climbName").textContent = `Current Climb: ${data.climb_name} (No. ${current_graph_index})`;
            const linksElement = document.getElementById("climbNameLink");
            linksElement.innerHTML = '';
            data.links.forEach(link => {
                const linkElement = document.createElement("a");
                linkElement.href = link.replace(/'/g, ''); // Remove single quotes if present
                linkElement.textContent = link.replace(/'/g, ''); // Remove single quotes for display
                linkElement.target = "_blank"; // Open in new tab
                linksElement.appendChild(linkElement);
                linksElement.appendChild(document.createElement("br")); // Line break for each link
            });
        });
}



function drawGraph(data) {
    const svg = d3.select("svg");
    svg.selectAll("*").remove();

    const holdTypeColors = {
        "Start": "#00FF00",
        "Middle": "#00FFFF",
        "Finish": "#FF00FF",
        "Foot Only": "#FFA500"
    };

    const nodes = svg.selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("cx", d => xScale(d.data.coordinates[0]))
        .attr("cy", d => yScale(d.data.coordinates[1]))
        .attr("r", 20)
        .attr("fill", "rgba(0,0,0,0)")
        .attr("stroke", d => holdTypeColors[d.data.hold_variant])
        .attr("stroke-width", 5)
        .attr("id", d => "node_" + d.id)
        .call(drag);
};

function displayEdges(edges) {
    const svg = d3.select("svg");

    // Define the arrowhead marker
    svg.append("defs")
        .append("marker")
        .attr("id", "arrowhead")
        .attr("refX", 6) // x-coordinate at the tip of the arrow
        .attr("refY", 3) // y-coordinate at the tip of the arrow
        .attr("markerWidth", 10) // marker width
        .attr("markerHeight", 6) // marker height
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L9,3 z") // Arrowhead path
        .style("fill", "black"); // Arrowhead color

    const edgeGroup = svg.append("g").attr("class", "edges"); // Create a group for edges

    // Example code to draw edges as lines with arrowheads
    const lines = edgeGroup
        .selectAll("line")
        .data(edges)
        .enter()
        .append("line")
        .attr("x1", d => {
            // Find the source node by its ID and get its x-coordinate
            const sourceNode = graphData.nodes.find(node => node.id === d.source);
            return xScale(sourceNode.data.coordinates[0]);
        })
        .attr("y1", d => {
            // Find the source node by its ID and get its y-coordinate
            const sourceNode = graphData.nodes.find(node => node.id === d.source);
            return yScale(sourceNode.data.coordinates[1]);
        })
        .attr("x2", d => {
            // Find the target node by its ID and get its x-coordinate
            const targetNode = graphData.nodes.find(node => node.id === d.target);
            return xScale(targetNode.data.coordinates[0]);
        })
        .attr("y2", d => {
            // Find the target node by its ID and get its y-coordinate
            const targetNode = graphData.nodes.find(node => node.id === d.target);
            return yScale(targetNode.data.coordinates[1]);
        })
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)"); // Add arrowhead marker

    // Additional code to customize the appearance of the edges as needed
    // You can style and customize the edges based on your requirements
}

function navigate(direction) {
    console.log("Graph data edges: ", graphData.edges);
    console.log("Edges before sending to backend: ", edges);
    

    // Send edges to the backend
    fetch('/saveEdges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(edges),
    })
        .then(response => {
            if (response.ok) {
                // Increment or decrement the current_graph_index based on direction
                if (direction === 'next') {
                    current_graph_index++;
                } else if (direction === 'previous') {
                    current_graph_index--;
                }
                // Continue with the navigation logic
                return fetch('/' + direction);
            } else {
                throw new Error("Failed to save edges");
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchGraphData();  // Already fetching graph data here
            }
        })
        .catch(error => {
            console.error("Error:", error);
        });
        edges = [];
    }

fetchGraphData();
fetchClimbName();
