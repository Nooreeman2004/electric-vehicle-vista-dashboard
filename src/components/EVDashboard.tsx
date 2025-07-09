
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import evData from '../data/ev_data.json';

interface EVRecord {
  VIN: string;
  County: string;
  City: string;
  State: string;
  'Postal Code': string;
  'Model Year': number;
  Make: string;
  Model: string;
  'Electric Vehicle Type': string;
  'Clean Alternative Fuel Vehicle (CAFV) Eligibility': string;
  'Electric Range': number;
  'Base MSRP': number;
  'Legislative District': string;
  'DOL Vehicle ID': number;
  'Vehicle Location': string;
  'Electric Utility': string;
  '2020 Census Tract': string;
}

interface Filters {
  state: string;
  county: string;
  city: string;
  modelYear: [number, number];
  make: string;
  model: string;
  cafv: boolean | null;
  electricRange: [number, number];
  baseMSRP: [number, number];
  utilityProvider: string;
}

const EVDashboard: React.FC = () => {
  const [data] = useState<EVRecord[]>(evData as EVRecord[]);
  const [filteredData, setFilteredData] = useState<EVRecord[]>(data);
  const [filters, setFilters] = useState<Filters>({
    state: '',
    county: '',
    city: '',
    modelYear: [2018, 2022],
    make: '',
    model: '',
    cafv: null,
    electricRange: [0, 500],
    baseMSRP: [0, 100000],
    utilityProvider: ''
  });

  // Chart refs
  const choroplethRef = useRef<SVGSVGElement>(null);
  const barChartRef = useRef<SVGSVGElement>(null);
  const boxPlotRef = useRef<SVGSVGElement>(null);
  const donutChartRef = useRef<SVGSVGElement>(null);
  const lineChartRef = useRef<SVGSVGElement>(null);
  const heatmapRef = useRef<SVGSVGElement>(null);
  const stackedBarRef = useRef<SVGSVGElement>(null);

  // Apply filters
  useEffect(() => {
    let filtered = data.filter(record => {
      return (
        (!filters.state || record.State === filters.state) &&
        (!filters.county || record.County === filters.county) &&
        (!filters.city || record.City === filters.city) &&
        (record['Model Year'] >= filters.modelYear[0] && record['Model Year'] <= filters.modelYear[1]) &&
        (!filters.make || record.Make === filters.make) &&
        (!filters.model || record.Model === filters.model) &&
        (filters.cafv === null || 
         (filters.cafv && record['Clean Alternative Fuel Vehicle (CAFV) Eligibility'].includes('Eligible')) ||
         (!filters.cafv && !record['Clean Alternative Fuel Vehicle (CAFV) Eligibility'].includes('Eligible'))) &&
        (record['Electric Range'] >= filters.electricRange[0] && record['Electric Range'] <= filters.electricRange[1]) &&
        (record['Base MSRP'] >= filters.baseMSRP[0] && record['Base MSRP'] <= filters.baseMSRP[1]) &&
        (!filters.utilityProvider || record['Electric Utility'] === filters.utilityProvider)
      );
    });
    setFilteredData(filtered);
  }, [filters, data]);

  // Get unique values for dropdowns
  const uniqueStates = [...new Set(data.map(d => d.State))];
  const uniqueCounties = [...new Set(data.map(d => d.County))];
  const uniqueCities = [...new Set(data.map(d => d.City))];
  const uniqueMakes = [...new Set(data.map(d => d.Make))];
  const uniqueModels = [...new Set(data.map(d => d.Model))];
  const uniqueUtilities = [...new Set(data.map(d => d['Electric Utility']))];

  // Calculate KPIs from filtered data
  const totalEVs = filteredData.length;
  const avgElectricRange = filteredData.length > 0 ? Math.round(filteredData.reduce((sum, d) => sum + d['Electric Range'], 0) / filteredData.length) : 0;
  const cafvPercentage = filteredData.length > 0 ? Math.round((filteredData.filter(d => d['Clean Alternative Fuel Vehicle (CAFV) Eligibility'].includes('Eligible')).length / filteredData.length) * 100) : 0;
  const avgMSRP = filteredData.length > 0 ? Math.round(filteredData.reduce((sum, d) => sum + d['Base MSRP'], 0) / filteredData.length) : 0;

  // Choropleth Map: EV count by city
  useEffect(() => {
    if (!choroplethRef.current || filteredData.length === 0) return;

    const svg = d3.select(choroplethRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const cityCounts = d3.rollup(
      filteredData,
      v => v.length,
      d => d.City
    );

    const chartData = Array.from(cityCounts, ([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(chartData.map(d => d.city))
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.count)!])
      .range([height, 0]);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(chartData, d => d.count)!]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Bars representing cities
    g.selectAll(".bar")
      .data(chartData)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.city)!)
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", "#3B82F6")
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`
          <strong>${d.city}</strong><br/>
          ${d.count} EVs registered<br/>
          <em>${d.city} leads in EV adoption with ${d.count} registered vehicles</em>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
        
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
        d3.select(this).style("opacity", 1);
      })
      .transition()
      .duration(800)
      .attr("y", d => y(d.count))
      .attr("height", d => height - y(d.count));

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    g.append("g")
      .call(d3.axisLeft(y));

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("EV Count by City");

  }, [filteredData]);

  // Bar Chart: Most popular EV makes and models
  useEffect(() => {
    if (!barChartRef.current || filteredData.length === 0) return;

    const svg = d3.select(barChartRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const makeModelCounts = d3.rollup(
      filteredData,
      v => v.length,
      d => `${d.Make} ${d.Model}`
    );

    const chartData = Array.from(makeModelCounts, ([key, value]) => ({ makeModel: key, count: value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(chartData.map(d => d.makeModel))
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.count)!])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Bars
    g.selectAll(".bar")
      .data(chartData)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.makeModel)!)
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", "#3B82F6")
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`
          <strong>${d.makeModel}</strong><br/>
          ${d.count} registered vehicles<br/>
          <em>${d.makeModel} is among the most popular EV choices with ${d.count} registrations</em>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
        
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
        d3.select(this).style("opacity", 1);
      })
      .transition()
      .duration(800)
      .attr("y", d => y(d.count))
      .attr("height", d => height - y(d.count));

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("fill", "white");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "white");

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("Popular EV Makes & Models");

  }, [filteredData]);

  // Box Plot: Electric range distribution by city
  useEffect(() => {
    if (!boxPlotRef.current || filteredData.length === 0) return;

    const svg = d3.select(boxPlotRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const cityData = d3.group(filteredData, d => d.City);
    const topCities = Array.from(cityData.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(topCities.map(d => d[0]))
      .padding(0.1);

    const allRanges = filteredData.map(d => d['Electric Range']);
    const y = d3.scaleLinear()
      .domain(d3.extent(allRanges) as [number, number])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    topCities.forEach(([city, records]) => {
      const ranges = records.map(d => d['Electric Range']).sort(d3.ascending);
      const q1 = d3.quantile(ranges, 0.25)!;
      const median = d3.quantile(ranges, 0.5)!;
      const q3 = d3.quantile(ranges, 0.75)!;
      const min = ranges[0];
      const max = ranges[ranges.length - 1];

      const centerX = x(city)! + x.bandwidth() / 2;

      // Box
      g.append("rect")
        .attr("x", x(city)!)
        .attr("y", y(q3))
        .attr("width", x.bandwidth())
        .attr("height", y(q1) - y(q3))
        .attr("fill", "#60A5FA")
        .attr("stroke", "#2563EB")
        .on("mouseover", function(event) {
          tooltip.transition().duration(200).style("opacity", .9);
          tooltip.html(`
            <strong>${city}</strong><br/>
            Median Range: ${median} mi<br/>
            Q1: ${q1} mi, Q3: ${q3} mi<br/>
            <em>${city} EVs have a median range of ${median} miles with typical variation shown in the box plot</em>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
          
          d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
          tooltip.transition().duration(500).style("opacity", 0);
          d3.select(this).style("opacity", 1);
        });

      // Median line
      g.append("line")
        .attr("x1", x(city)!)
        .attr("x2", x(city)! + x.bandwidth())
        .attr("y1", y(median))
        .attr("y2", y(median))
        .attr("stroke", "#1E40AF")
        .attr("stroke-width", 2);

      // Min/Max lines
      g.append("line")
        .attr("x1", centerX)
        .attr("x2", centerX)
        .attr("y1", y(min))
        .attr("y2", y(q1))
        .attr("stroke", "#2563EB");

      g.append("line")
        .attr("x1", centerX)
        .attr("x2", centerX)
        .attr("y1", y(q3))
        .attr("y2", y(max))
        .attr("stroke", "#2563EB");
    });

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", "white");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "white");

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("Electric Range by City");

  }, [filteredData]);

  // Donut Chart: CAFV eligibility percentage
  useEffect(() => {
    if (!donutChartRef.current || filteredData.length === 0) return;

    const svg = d3.select(donutChartRef.current);
    svg.selectAll("*").remove();

    const width = 400;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;
    const innerRadius = radius * 0.6;

    const cafvEligible = filteredData.filter(d => d['Clean Alternative Fuel Vehicle (CAFV) Eligibility'].includes('Eligible')).length;
    const notEligible = filteredData.length - cafvEligible;

    const data = [
      { label: 'CAFV Eligible', value: cafvEligible, color: '#10B981' },
      { label: 'Not Eligible', value: notEligible, color: '#EF4444' }
    ];

    const pie = d3.pie<any>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const arcs = g.selectAll(".arc")
      .data(pie(data))
      .enter().append("g")
      .attr("class", "arc");

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .style("opacity", 0)
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`
          <strong>${d.data.label}</strong><br/>
          ${d.data.value} vehicles (${Math.round(d.data.value / filteredData.length * 100)}%)<br/>
          <em>${d.data.label === 'CAFV Eligible' ? 'These vehicles qualify for clean fuel incentives' : 'These vehicles do not qualify for CAFV benefits'}</em>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
        
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
        d3.select(this).style("opacity", 1);
      })
      .transition()
      .duration(800)
      .style("opacity", 1)
      .attrTween("d", function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t));
        };
      });

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.5em")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text(`${cafvPercentage}%`);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .style("font-size", "12px")
      .style("fill", "white")
      .text("CAFV Eligible");

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("CAFV Eligibility");

  }, [filteredData, cafvPercentage]);

  // Line Chart: Model year trend
  useEffect(() => {
    if (!lineChartRef.current || filteredData.length === 0) return;

    const svg = d3.select(lineChartRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const yearCounts = d3.rollup(
      filteredData,
      v => v.length,
      d => d['Model Year']
    );

    const chartData = Array.from(yearCounts, ([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);

    const x = d3.scaleLinear()
      .domain(d3.extent(chartData, d => d.year) as [number, number])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.count)!])
      .range([height, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const line = d3.line<any>()
      .x(d => x(d.year))
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    // Line path
    const path = g.append("path")
      .datum(chartData)
      .attr("fill", "none")
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 3)
      .attr("d", line);

    // Animate line drawing
    const totalLength = path.node()!.getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .attr("stroke-dashoffset", 0);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Data points
    g.selectAll(".dot")
      .data(chartData)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.count))
      .attr("r", 0)
      .attr("fill", "#1D4ED8")
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`
          <strong>${d.year}</strong><br/>
          ${d.count} EVs registered<br/>
          <em>Model year ${d.year} shows ${d.count > 20 ? 'strong' : 'moderate'} EV adoption with ${d.count} registrations</em>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
        
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
        d3.select(this).style("opacity", 1);
      })
      .transition()
      .delay(1500)
      .duration(500)
      .attr("r", 4);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("fill", "white");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "white");

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("EV Registrations by Model Year");

  }, [filteredData]);

  // Heatmap: Average MSRP by city
  useEffect(() => {
    if (!heatmapRef.current || filteredData.length === 0) return;

    const svg = d3.select(heatmapRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 80 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const cityMSRP = d3.rollup(
      filteredData,
      v => d3.mean(v, d => d['Base MSRP'])!,
      d => d.City
    );

    const chartData = Array.from(cityMSRP, ([city, avgMSRP]) => ({ city, avgMSRP }))
      .sort((a, b) => b.avgMSRP - a.avgMSRP)
      .slice(0, 8);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(['MSRP'])
      .padding(0.1);

    const y = d3.scaleBand()
      .range([height, 0])
      .domain(chartData.map(d => d.city))
      .padding(0.1);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(chartData, d => d.avgMSRP) as [number, number]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Heatmap cells
    g.selectAll(".cell")
      .data(chartData)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", x('MSRP')!)
      .attr("y", d => y(d.city)!)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => colorScale(d.avgMSRP))
      .style("opacity", 0)
      .transition()
      .duration(800)
      .style("opacity", 1);

    // Text labels
    g.selectAll(".text")
      .data(chartData)
      .enter().append("text")
      .attr("class", "text")
      .attr("x", x('MSRP')! + x.bandwidth() / 2)
      .attr("y", d => y(d.city)! + y.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .style("font-size", "10px")
      .style("fill", "white")
      .text(d => `$${Math.round(d.avgMSRP / 1000)}k`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", "white");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "white");

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("Average MSRP by City");

  }, [filteredData]);

  // Stacked Bar Chart: EV count by utility provider and type
  useEffect(() => {
    if (!stackedBarRef.current || filteredData.length === 0) return;

    const svg = d3.select(stackedBarRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 80, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const utilityTypes = d3.rollup(
      filteredData,
      v => d3.rollup(v, vv => vv.length, d => d['Electric Vehicle Type']),
      d => d['Electric Utility']
    );

    const evTypes = [...new Set(filteredData.map(d => d['Electric Vehicle Type']))];
    const utilities = Array.from(utilityTypes.keys()).slice(0, 5);

    const stackData: any[] = utilities.map(utility => {
      const obj: any = { utility };
      evTypes.forEach(type => {
        obj[type] = utilityTypes.get(utility)?.get(type) || 0;
      });
      return obj;
    });

    const stack = d3.stack()
      .keys(evTypes)
      (stackData);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(utilities)
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stack, d => d3.max(d, d => d[1]))!])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(evTypes)
      .range(['#3B82F6', '#10B981']);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Stacked bars
    g.selectAll(".layer")
      .data(stack)
      .enter().append("g")
      .attr("class", "layer")
      .attr("fill", d => color(d.key) as string)
      .selectAll("rect")
      .data(d => d)
      .enter().append("rect")
      .attr("x", d => x(String(d.data.utility)) || 0)
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .on("mouseover", function(event, d) {
        const value = d[1] - d[0];
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`
          <strong>${d.data.utility}</strong><br/>
          ${stack.find(layer => layer.includes(d))?.key}: ${value} EVs<br/>
          <em>This utility provider has ${value} registered ${stack.find(layer => layer.includes(d))?.key} vehicles</em>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
        
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
        d3.select(this).style("opacity", 1);
      })
      .transition()
      .duration(800)
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]));

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("fill", "white");

    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "white");

    // Title
    svg.append("text")
      .attr("x", width / 2 + margin.left)
      .attr("y", margin.top - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .text("EV Count by Utility & Type");

  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-blue-500/20 p-6">
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Electric Vehicle Registration Dashboard
        </h1>
      </div>

      {/* KPIs at the Top */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-center shadow-lg">
            <div className="text-3xl font-bold">{totalEVs.toLocaleString()}</div>
            <div className="text-blue-100">Total EVs Registered</div>
          </div>
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-center shadow-lg">
            <div className="text-3xl font-bold">{avgElectricRange}</div>
            <div className="text-green-100">Avg Electric Range (mi)</div>
          </div>
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-center shadow-lg">
            <div className="text-3xl font-bold">{cafvPercentage}%</div>
            <div className="text-purple-100">CAFV Eligible</div>
          </div>
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-6 text-center shadow-lg">
            <div className="text-3xl font-bold">${avgMSRP.toLocaleString()}</div>
            <div className="text-orange-100">Avg Base MSRP</div>
          </div>
        </div>
      </div>

      {/* Filters at the Top */}
      <div className="px-6 pb-6">
        <div className="bg-slate-800/30 backdrop-blur-sm border border-blue-500/20 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* State Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">State</label>
              <select 
                value={filters.state} 
                onChange={(e) => setFilters({...filters, state: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All States</option>
                {uniqueStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* County Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">County</label>
              <select 
                value={filters.county} 
                onChange={(e) => setFilters({...filters, county: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Counties</option>
                {uniqueCounties.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
              <select 
                value={filters.city} 
                onChange={(e) => setFilters({...filters, city: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Cities</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Make Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Make</label>
              <select 
                value={filters.make} 
                onChange={(e) => setFilters({...filters, make: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Makes</option>
                {uniqueMakes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>

            {/* Model Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Model</label>
              <select 
                value={filters.model} 
                onChange={(e) => setFilters({...filters, model: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Models</option>
                {uniqueModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            {/* CAFV Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">CAFV Eligibility</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilters({...filters, cafv: null})}
                  className={`px-3 py-1 rounded text-sm ${filters.cafv === null ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilters({...filters, cafv: true})}
                  className={`px-3 py-1 rounded text-sm ${filters.cafv === true ? 'bg-green-600' : 'bg-slate-600'}`}
                >
                  Eligible
                </button>
                <button
                  onClick={() => setFilters({...filters, cafv: false})}
                  className={`px-3 py-1 rounded text-sm ${filters.cafv === false ? 'bg-red-600' : 'bg-slate-600'}`}
                >
                  Not Eligible
                </button>
              </div>
            </div>

            {/* Utility Provider Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Utility Provider</label>
              <select 
                value={filters.utilityProvider} 
                onChange={(e) => setFilters({...filters, utilityProvider: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Providers</option>
                {uniqueUtilities.map(utility => (
                  <option key={utility} value={utility}>{utility}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Charts Grid */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Choropleth Map (EV count by city) */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={choroplethRef} width="100%" height="350"></svg>
          </div>

          {/* Bar Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={barChartRef} width="100%" height="350"></svg>
          </div>

          {/* Box Plot */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={boxPlotRef} width="100%" height="350"></svg>
          </div>

          {/* Donut Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={donutChartRef} width="100%" height="350"></svg>
          </div>

          {/* Line Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={lineChartRef} width="100%" height="350"></svg>
          </div>

          {/* Heatmap */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={heatmapRef} width="100%" height="350"></svg>
          </div>

          {/* Stacked Bar Chart - spans full width */}
          <div className="xl:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
            <svg ref={stackedBarRef} width="100%" height="350"></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EVDashboard;
