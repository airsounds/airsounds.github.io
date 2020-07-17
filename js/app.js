Date.prototype.addHours= function(h){
  this.setHours(this.getHours()+h);
  return this;
}

var currentTime = new Date();
// Truncate time to 3h.
currentTime.setHours(Math.round(currentTime.getHours() / 3) * 3)

var currentDate = new Date();
currentDate.setHours(0);

var currentPlottedData = null;

const graphMaxRatio = 0.6;
function calcPlotSize() {
  h = $("#graph").parent().height();
  w = $("#graph").parent().width();
  if (w > h * graphMaxRatio) {
    w = h * graphMaxRatio;
  }
  return {w: w, h: h}
}
var currentPlotSize = calcPlotSize();

const place = "megido";

const M = -1000.0 / 3.0

const X = [0, 50]
const Y = [0, 6000]
const hours = [0, 3, 6, 9, 12, 15, 18, 21]
const importantHours = [6, 9, 12, 15, 18]

const xTicks = 10;
const yTicks = 15;

async function main() {
  d3.select(window).on('resize.updatesvg', function() {
    size = calcPlotSize()
    if (size.w != currentPlotSize.w || size.h != currentPlotSize.h) {
      currentPlotSize = size;
      plotData()
    }
  });
  
  idexResp = await fetch("/data/index.json");
  if (!idexResp.ok) {
    error("Failed getting index", `Response: ${idexResp.status}`);
    return;
  }
  idx = await idexResp.json()
  index.$data.days = await fetchData(new Date(idx.NoaaEnd));
  index.$data.places = [
    {text: place},
  ]

  // Update the plot with the most recent data.
  hoursIndex = importantHours.filter(h => h <= new Date().getHours()).length-1;
  update(0, hoursIndex)
}

async function fetchData(maxTime) {
  var days = []
  var t = currentDate
  var dayi = 0
  while (true) {  
    var day = {
      text: dateFormat(t),
      hours: [],
    }
    for (i in importantHours) {
      hour = importantHours[i]
      t.setHours(hour)
      if (t > maxTime) {
        return days
      }
      data = await fetchTime(day, hour);
      badge = "badge badge-success";
      if (data == undefined) {
        badge = "badge badge-danger";
      }
      day.hours.push({
        text: pad(hour),
        call: 'update(' + dayi + ', ' + i + ')',
        data: data,
        badge: badge,
      })
    }
    t.setHours(0)
    t.setDate(t.getDate() + 1);
    days.push(day)
    dayi++;
  }
}

async function fetchTime(day, hour) {
  var datePath = "/data/" + day.text.replace('-', '/').replace('-', '/') + '/' + pad(hour) + "/";
  console.log("fetching data for ", day, hour)
  const noaaResp = await fetch(datePath + `noaa-${place}.json`)
  const imsResp = await fetch(datePath + `ims-${place}.json`)

  var errors = 0

  if (!noaaResp.ok) {
    console.warn(`NOAA data for ${day.text}, ${hour}:00 is not available (${noaaResp.status})`)
    errors++
  }
  if (!imsResp.ok) {
    console.warn(`IMS data for ${day.text}, ${hour}:00 is not available (${imsResp.status})`)
    errors++
  }

  if (errors > 0) {
    return null;
  }

  return {
    noaa: await noaaResp.json(),
    ims: await imsResp.json(),
  }
}

function y(x, x0, y0) {
  return M * (x - x0) + y0
}

var header = new Vue({
  el: '#header',
  data: {
    day: null,
    hour: null,
    place: null,
  },
})

var index = new Vue({
  el: "#index",
  data: {
    days: [],
    places: [],
  },
})

var errors = new Vue({
  el: "#errors",
  data: {
    errors: [],
  },
})

function dateFormat(d) {
  return d.getFullYear() + "-"
      + pad(d.getMonth()+1) + "-"
      + pad(d.getDate())
}

function hourFormat(d) {
  return pad(d.getHours()) + "h";
}

function timeFormat(d) {
    return dateFormat(d) + " " + hourFormat(d);
}

function timePath(d) {
    return d.getFullYear() + "/"
        + pad(d.getMonth()+1) + "/"
        + pad(d.getDate()) + "/"
        + pad(d.getHours());
}

function pad(n) {
    return n<10 ? '0'+n : n;
}

// Returns point (xi, yi) for which x(y) intersect a line with slope M that goes through (x0, y0).
// Returns null if no intersection.
function intersect(x, y, x0, y0, m0) {

  x0 = 1.0 * x0;
  y0 = 1.0 * y0;
  m0 = 1.0 * m0;

  // Calculate the diff vector.
  var diff = []
  for (i in x) {
    diff.push(x0 + ((y[i] - y0) / m0) - x[i]);
  }

  // Find where diff vector changes from positive to negative value.
  var i = 0
  while (true) {
    if (diff[i] < 0) {
      break;
    }
    i++;
  }

  // No intersection.
  if (i < 1) {
    return null;
  }

  // Find where a line between p1 and p2 crosses the y=0 line.
  p1 = [x[i-1], diff[i-1]]
  p2 = [x[i], diff[i]]
  m = (p2[1] - p1[1]) / (p2[0] - p1[0])
  xi = p1[0] - p1[1] / m
  
  // Calculate the linear line value in the intersection location.
  yi = y0 + m0 * (xi - x0)
  return [xi, yi]
}

function plotData(data) {
  data = currentPlottedData;
  width = currentPlotSize.w;
  height = currentPlotSize.h;

  let alt = data.noaa['Height'].filter(v => v <= Y[1]*2);
  let temp = data.noaa['Temp'];
  let dew = data.noaa['Dew'];
  let t0 = data.ims['Temp'];
  let h0 = 200;

  // Thermal index calculations.
  TI = intersect(temp, alt, t0, h0, M)
  if (TI == null) {
    TI = [0, h0]
  }
  TIM3 = intersect(temp, alt, t0-3, h0, M)
  if (TIM3 == null) {
    TIM3 = [0, h0]
  }

  // Cloud base calculation.
  cloudBase = null;
  dewH0 = intersect(alt, dew, h0, 0, 1)
  if (dewH0 != null) {
    cloudBase = 1000.0 / 2.5 * (t0 - dewH0[1]) + h0
    if (cloudBase < 0) {
      cloudBase = null;
    }
  }
  
  margin = ({top: 20, right: 30, bottom: 30, left: 40})
  var svg = d3
    .select("#graph")
    .attr("width", width)
    .attr("height", height);
  
  // Clear content before plotting.
  svg.selectAll('*').remove()
  xScale = d3.scaleLinear()
    .domain(X)
    .nice()
    .range([margin.left, width-margin.right]);
  yScale = d3.scaleLinear()
    .domain(Y)
    .nice()
    .range([height-margin.bottom, margin.top]);

  function drawLine(x, y, color, width, duration, dashed) {
    data = []
    for (i in alt) {
      data.push(({x: xScale(x[i]), y: yScale(y[i])}))
    }
    
    line = d3.line()
      .curve(d3.curveCatmullRom)
      .x(d => d.x)
      .y(d => d.y)
     function length(path) {
      return d3.create("svg:path").attr("d", path).node().getTotalLength();
    }
    
    const l = length(line(data));
    dash = `${l},${l}`;
    if (dashed) {
      dash = "10";
    }
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", width)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", `0,${l}`)
      .attr("d", line)
      .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("stroke-dasharray", dash);
  }
  function drawPoint(x, y, color) {
    data = [{x: xScale(x), y: yScale(y)}]
    svg.append("g")
      .attr("fill", "white")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 3);
  }
  function drawText(x, y, text, orient) {
    data = [{x: xScale(x), y: yScale(y)}]
    const label = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 13)
      .selectAll("g")
      .data(data)
      .join("g")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("opacity", 1);
    label.append("text")
      .text(text)
      .each(function(d) {
        const t = d3.select(this);
        switch (orient) {
          case "top": t.attr("text-anchor", "middle").attr("dy", "-0.7em"); break;
          case "right": t.attr("dx", "0.5em").attr("dy", "0.32em").attr("text-anchor", "start"); break;
          case "bottom": t.attr("text-anchor", "middle").attr("dy", "1.4em"); break;
          case "left": t.attr("dx", "-0.5em").attr("dy", "0.32em").attr("text-anchor", "end"); break;
        }
      })
      .call(halo);
  }
  function drawPolygon(points, color, width) {
    data = []
    for (i in points) {
      data.push([xScale(points[i][0]), yScale(points[i][1])])
    }
    svg.append("polygon")
      .datum(data)
      .attr("points", pts => pts.map(p => p.join(",")).join(" "))
      .attr("fill", color)
      .attr('opacity', 0.2)
      .attr("stroke", color)
      .attr("stroke-width", width)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
  }
  // Draw axes.
  xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(xTicks))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
        .attr("y2", -height)
        .attr("stroke-opacity", 0.1))
    .call(g => g.append("text")
        .attr("x", width - 4)
        .attr("y", -4)
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr("fill", "black")
        .text("T[c]")
        .call(halo))
  yAxis = g => g
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).ticks(yTicks, "s"))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width)
        .attr("stroke-opacity", 0.1))
    .call(g => g.select(".tick:last-of-type text").clone()
        .attr("x", 4)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("fill", "black")
        .text("H[ft]")
        .call(halo))

  svg.append("g").call(xAxis);
  svg.append("g").call(yAxis);

  // Draw diagonal ticks.
  for(x0 = X[1]; x0 > X[0]; x0 -= (X[1] - X[0]) / xTicks) {
    drawLine(
      [X[0], x0],
      [y(X[0], x0, Y[0]), Y[0]],
      '#ebecf0',
      1,
      0);
  }
  // Draw ground.
  drawPolygon(
    [
      [X[0], Y[0]],
      [X[1], Y[0]],
      [X[1], h0],
      [X[0], h0],
    ],
    "#D2691E", 1.5)
  drawText(X[0], h0, `Alt ${h0} ft`, "top")
  // Max temperature diagonals.
  drawPolygon(
    [
      [t0, h0],
      [t0-3, h0],
      [X[0], y(X[0], t0-3, h0)],
      [X[0], y(X[0], t0, h0)],
      
    ],
    "red", 0
  )
  drawLine([X[0], t0], [y(X[0], t0, h0), h0], "red", 1, 100)
  drawPoint(t0, h0, "red")
  drawText(t0, h0, "Tmax "+ t0 + "C", "right")

  // Thermal indices.
  drawPolygon(
    [
      [X[0], TI[1]],
      [X[1], TI[1]],
      [X[1], TIM3[1]],
      [X[0], TIM3[1]]
    ],
    "blue", 0
  )
  drawText(X[1], TI[1], "TI: " + TI[1].toFixed(0) + "ft", "left")
  drawText(X[1], TIM3[1], "TI-3: " + TIM3[1].toFixed(0) + "ft", "left")
  // Draw temperature graphs.
  drawLine(temp, alt, "red", 2.5, 1500);
  drawLine(dew, alt, "blue", 2.5, 1500);

  // Draw cloud base.
  if (cloudBase != null) {
    cloudBaseY = Math.min(cloudBase, Y[1]);
    if (cloudBase <= Y[1]) {
      drawLine(
        X, [cloudBaseY, cloudBaseY],
        "blue", 1, 500, true)
    }
    drawText(X[1], cloudBaseY, "Cloud base: " + cloudBase.toFixed(0) + "ft", "left")
  }

  function halo(text) {
    text.select(function() { return this.parentNode.insertBefore(this.cloneNode(true), this); })
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round");
  }
}

async function update(dayi, houri) {
  day = index.$data.days[dayi]
  hour = day.hours[houri]

  // Update headers.
  header.$data.day = day.text
  header.$data.hour = hour.text
  header.$data.place = place

  if (hour.data == undefined) {
    error("No data", "for chosen date");
    return;
  }
  currentPlottedData = hour.data;
  plotData();
}

function error(title, msg) {
  errors.$data.errors.push({title: title, text: msg})  
}

main()