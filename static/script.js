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
let edgeIndex = 0;

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
    graphData.edges = []; // Clear the edges in the graph data
    d3.selectAll("line").remove(); // Remove all edge lines
    edgeIndex = 0; // Reset edge index
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
        .attr("stroke", "rgba(0, 0, 0, 0.7)")
        .attr("stroke-width", 7)
        .attr("marker-end", "url(#arrowhead)"); // Add arrowhead marker
}

function dragged(d) {
    if (!line) return;
    line.attr("x2", d3.event.x)
        .attr("y2", d3.event.y);
}

function dragended(d) {
    if (!line || !sourceNode) return;

    const targetNode = graphData.nodes.find(n => {
        return Math.sqrt((xScale(n.data.coordinates[0]) - d3.event.x) ** 2 + (yScale(n.data.coordinates[1]) - d3.event.y) ** 2) < 20;
    });

    if (targetNode && targetNode !== sourceNode) {
        // Add the new edge with the current edge index
        edges.push({
            source: sourceNode.id,
            target: targetNode.id,
            index: edgeIndex++ // Increment edge index after adding the edge
        });
        d3.select("svg").append("line")
            .attr("x1", xScale(sourceNode.data.coordinates[0]))
            .attr("y1", yScale(sourceNode.data.coordinates[1]))
            .attr("x2", xScale(targetNode.data.coordinates[0]))
            .attr("y2", yScale(targetNode.data.coordinates[1]))
            .attr("stroke", "black")
            .attr("stroke-width", 5)
            .attr("marker-end", "url(#arrowhead)"); // Add arrowhead marker
    }
    line.remove();
    line = null;
    sourceNode = null; 
    console.log(`Current edges array:`, edges);
}
function searchGraphs() {
    const query = document.getElementById('searchInput').value;
    fetch('/searchGraphs?query=' + encodeURIComponent(query))
        .then(response => response.json())
        .then(graphIndex => {
            // Assuming the response is an integer (graph index)
            displaySearchResults(graphIndex);  // Pass the graph index to the function
        })
        .catch(error => console.error('Error:', error));
}

function displaySearchResults(graphIndex) {
    navigateToGraph(graphIndex);  // Call navigateToGraph with the graph index
}

function navigateToGraph(graphIndex) {
    current_graph_index = graphIndex;  // Update the current graph index
    fetchGraphData();  // Fetch and display the graph
    fetchClimbName(graphIndex);  // Fetch and display the climb name
}

function fetchEdgesData() {
    return fetch('/getEdges')
        .then(response => response.json())
        .then(data => {
            // Transform the data to match the expected format
            return data.edges.map(edge => ({
                source: edge[0], // Extract source from the tuple
                target: edge[1], // Extract target from the tuple
                index: edge[2]   // Extract index from the tuple
            }));
        });
}

function updateGraphDataEdges() {
    fetchEdgesData().then(edges => {
        graphData.edges = edges;
        displayEdges(edges); // Redraw edges with the new data
        // Additional logic to handle the updated edges if necessary
    });
}

function updatenewGraphDataEdges() {
    // Ensure graphData.edges is an array
    graphData.edges = graphData.edges || [];

    // Find edges that are present in graphData.edges and update their index if needed
    const updatedGraphDataEdges = graphData.edges.map(graphEdge => {
        const matchingDrawnEdge = edges.find(drawnEdge =>
            drawnEdge.source === graphEdge.source && drawnEdge.target === graphEdge.target
        );
        // If a matching edge is found and it has an index, update the graphEdge with that index
        if (matchingDrawnEdge && matchingDrawnEdge.hasOwnProperty('index')) {
            return {
                ...graphEdge, // Preserve other properties
                index: matchingDrawnEdge.index
            };
        }
        return graphEdge;
    });

    // Find new edges that are not in graphData.edges and add them
    const newEdges = edges.filter(drawnEdge =>
        !graphData.edges.some(graphEdge =>
            (graphEdge.source === drawnEdge.source && graphEdge.target === drawnEdge.target) ||
            (graphEdge.source === drawnEdge.target && graphEdge.target === drawnEdge.source) // For undirected graphs
        )
    );

    // Combine the updated existing edges with the new edges
    graphData.edges = [...updatedGraphDataEdges, ...newEdges];
}

function fetchGraphData() {
    fetch('/graph')
        .then(response => response.json())
        .then(data => {
            graphData = data;
            drawGraph(data);
            updateGraphDataEdges(); // Make sure to call this instead of displayEdges directly
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
                const cleanLink = link.replace(/'/g, ''); // Remove single quotes if present
                // console.log("Clean link: ", cleanLink);

                if (cleanLink.includes("instagram.com")) {
                    const iframe = document.createElement("iframe");
                    iframe.width = "400"; // Width of the video frame, adjust as needed
                    iframe.height = "400"; // Height of the video frame, adjust as needed
                    iframe.frameBorder = "0";
                    iframe.allow = "autoplay; encrypted-media";
                    iframe.allowFullScreen = true;
                    iframe.src = `${cleanLink.replace(/\/+$/, "")}/embed/`;
                    linksElement.appendChild(iframe);
                } else {
                    const linkElement = document.createElement("a");
                    linkElement.href = cleanLink;
                    linkElement.textContent = cleanLink;
                    linkElement.target = "_blank"; // Open in new tab
                    linksElement.appendChild(linkElement);
                }
                linksElement.appendChild(document.createElement("br")); // Line break for each link or iframe
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
        .attr("markerHeight", 7) // marker height
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L9,3 z") // Arrowhead path
        // .style("fill", "black"); // Arrowhead color
        .style("fill", "transparent"); // Make the arrowhead completely transparent


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
        .attr("stroke", "rgba(0, 0, 0, 0.5)") // Semi-transparent black
        .attr("stroke-width", 30) // Increased line width
        .attr("marker-end", "url(#arrowhead)") // Add arrowhead marker
        .classed("edge", true) // Add class for styling if needed
        .style("cursor", "pointer") // Change cursor style to indicate interactivity
        .on("mouseover", function () {
            // Highlight the edge on hover
            d3.select(this).attr("stroke", "rgba(255, 0, 0, 0.7)"); // Red and semi-transparent
        })
        .on("mouseout", function () {
            // Restore the original stroke color on mouseout
            d3.select(this).attr("stroke", "rgba(0, 0, 0, 0.5)"); // Semi-transparent black
        })
        .on("click", edgeClicked); // Add click handler for edges

    // Additional code to customize the appearance of the edges as needed
    // You can style and customize the edges based on your requirements
}

function edgeClicked(d, i) {
    // Add the edge index to the edge data
    d.index = edgeIndex++;

    // You can store the edge index in the DOM, or keep it in a separate data structure
    d3.select(this).attr("data-index", d.index);
    const sourceNode = graphData.nodes.find(node => node.id === d.source);
    const targetNode = graphData.nodes.find(node => node.id === d.target);
    
    let xMid, yMid;
    if (sourceNode && targetNode) {
        xMid = (xScale(sourceNode.data.coordinates[0]) + xScale(targetNode.data.coordinates[0])) / 2;
        yMid = (yScale(sourceNode.data.coordinates[1]) + yScale(targetNode.data.coordinates[1])) / 2;
    }
    
    d3.select(this.parentNode) // Assuming 'this' is the line inside a 'g' group
        .append("text")
        .attr("x", xMid)
        .attr("y", yMid)
        .text(d.index)
        .attr("fill", "red") // Change text color if needed
        .attr("font-size", "25px") // Adjust font size as needed
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central");

        d3.select(this).attr("data-index", edgeIndex - 1);
        console.log("Edge clicked: ", d);
}
function navigate(direction) {
    console.log("Graph data edges: ", graphData.edges);
    console.log("Edges: ", edges);
    updatenewGraphDataEdges();
    console.log("Graph data edges: ", graphData.edges);
    // Use `graphData.edges` to send to the backend instead of `edges`
    fetch('/saveEdges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Make sure to reference `graphData.edges` here
        body: JSON.stringify(graphData.edges),
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
            fetchGraphData();  // This function should handle updating the graph
        }
    })
    .catch(error => {
        console.error("Error:", error);
    });
    edgeIndex = 0;
    edges = [];
}
// search button press with enter key
document.getElementById('searchInput').addEventListener('keyup', function(event) {
    // Check if the pressed key is the Enter key
    if (event.key === 'Enter' || event.keyCode === 13) {
        searchGraphs(); // Call the searchGraphs function
    }
});
// // Listen for keyboard events
// document.addEventListener('keydown', (event) => {
//     // Check if the event key is 'w' (for next) or 'a' (for previous)
//     if (event.key === 'w') {
//         // Navigate to the next page here
//         navigate('next');
//     } else if (event.key === 'a') {
//         // Navigate to the previous page here
//         navigate('previous');
//     }
// });


fetchGraphData();
fetchClimbName();
