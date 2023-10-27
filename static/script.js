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

let graphData;  // Top-level variable for storing graph data

document.getElementById("toggleConnectMode").addEventListener('click', () => {
    isConnectMode = !isConnectMode;
    console.log("Connect mode: " + isConnectMode);
    if(isConnectMode) {
        d3.selectAll("circle").call(drag);
    } else {
        d3.selectAll("circle").on('.drag', null);
    }
});

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
        .attr("stroke-width", 2);
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
        return Math.sqrt((xScale(n.data.coordinates[0]) - d3.event.x)**2 + (yScale(n.data.coordinates[1]) - d3.event.y)**2) < 10;
    });

    if (targetNode && targetNode !== sourceNode) {
        edges.push([sourceNode.id, targetNode.id]);
        d3.select("svg").append("line")
            .attr("x1", xScale(sourceNode.data.coordinates[0]))
            .attr("y1", yScale(sourceNode.data.coordinates[1]))
            .attr("x2", xScale(targetNode.data.coordinates[0]))
            .attr("y2", yScale(targetNode.data.coordinates[1]))
            .attr("stroke", "black")
            .attr("stroke-width", 2);
    }

    line.remove();
    line = null;
    sourceNode = null;
}

function fetchGraphData() {
    fetch('/graph')
        .then(response => response.json())
        .then(data => {
            graphData = data;  // Update the top-level variable
            drawGraph(data);
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
}

function navigate(direction) {
    // Send edges to the backend
    fetch('/saveEdges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(edges),
    })
    .then(response => {
        if(response.ok) {
            // Continue with the navigation logic
            return fetch('/' + direction);
        } else {
            throw new Error("Failed to save edges");
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchGraphData();
        }
    })
    .catch(error => {
        console.error("Error:", error);
    });
}
