/**
 * @fileOverview A D3 based chart for tracking progress against goals. Variation of a bullet chart.
 * @version 1.0
 */

/**
 * Creates a pacing chart
 * @param settings Configuration options for the base plot
 * @param settings.data The data for the plot
 * @param {string} settings.selector The selector string for the main chart div
 * @param settings.targetsCol The name of the columns used to define the targets. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.targetsMarkersCols] The name of the columns used to define the target markers. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param settings.resultsCols The name of the columns used to define the results. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.resultsMarkersCols] The name of the columns used to define the results markers. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.titleCols] Array where the first column name is used as a title, the second (optional) one is used as a subtitle. NOTE: Title must be unique, subtitle does not need to be
 * @param settings.chartWidth=500 The Max width of each chart within  the collection of charts
 * @param settings.barHeight=35 The height of each bar, each chart is two stacked charts to this value x2 is the total height of each subchart
 * @param settings.titlePadding=100 How much space to the left of the charts should be allocated to the title. The bar chart portion is adjusted down to the remaining space
 * @param settings.lowerSummaryPadding=20 How much space to add below the charts to allow for results if the results exceed the end of the chart
 * @param settings.minWidthForPercent=100 The minimum numbers of pixels a result bar will be for the percent to be shown. Below this threshold, only the value is rendered
 * @param settings.cumulativeTargets=true If true, the targets are subsets of each other ie. the largest target is the total target. If false, the total target is the sum of all the targets.
 * @param settings.cumulativeResults=true If true, the results are subsets of each other ie. the largest result is the total result. If false, the total result is the sum of all the results.
 * @param settings.summarizeTargets=false If true, show a separate bar above the targets that is a sum of all the individual targets, mostly useful when paired with cumulativeTargets=false
 * @param settings.summarizeResults=false If true, show a separate bar above the results that is a sum of all the individual results, mostly useful when paired with cumulativeResults=false
 * @returns {object} chart A chart object
 */

/**
 * Additional Settings that can be set post creation on the returned chart object.
 * @param chart.formatterValue - Takes a number and formats it. ie 4500000 -> 4.5M
 * @param chart.formatterPercent - Takes a percent and formats it. ie 23.454234% -> 23.5%
 * @param chart.formatterValueTooltip - Takes a number and formats it. ie 4500000 -> 4.5M. Separate from formatterValue to allow for flexibility in the tooltip
 * @param chart.tooltipHover - Returns a html text string that populates the hovertool tip.
 */

function makePacingChart(settings) {

    let chart = {};

    // Defaults
    chart.settings = {
        data: null,
        selector: null,
        targetsCols: [],
        targetsMarkersCols: [],
        resultsCols: [],
        resultMarkersCols: [],
        titleCols: [],
        chartWidth: 500,
        barHeight: 35,
        titlePadding: 100,
        lowerSummaryPadding: 20,
        minWidthForPercent: 100,
        cumulativeTargets: true,
        cumulativeResults: true,
        summarizeTargets: false,
        summarizeResults: false,
        constrainToTarget: false, // Not implemented
        constrainToTargetAdj: 50 // Not implemented
    };

    // Copy from function parameters to settings
    for (let setting in settings) {
        chart.settings[setting] = settings[setting]
    }

    chart.formatterValue = (d) => {
        // If no decimals then format without the decimals
        let dmod = Math.ceil(Math.log10(d + 1)) % 3;
        if (dmod === 0) {
            // If there are decimal points
            return d3.format(".3s")(d);
        } else {
            return d3.format("."+(dmod+1)+"s")(d);
        }
    }

    chart.formatterValueToolTip = (d) => {
        // ALways return at least 1 decimal in abbreviated view
        let dmod = Math.ceil(Math.log10(d + 1))%3;
        if (dmod === 0) {
            // If there are decimal points
            return d3.format(".5s")(d);
        } else {
            return d3.format("."+(dmod+2)+"s")(d);
        }
    }

    chart.formatterPercent = (d) => {
        // If no decimals then format without the decimals
        if ((d*100) % 1 !== 0) {
            return d3.format(",.2%")(d);
        } else {
            return d3.format(",.0%")(d);
        }
    }

    chart.data = chart.settings.data;

    chart.groupObjs = {}; //The data organized by subchart(row)
    chart.objs = {mainDiv: null, chartDiv: null, g: null};

    /**
     * Closure that creates the tooltip hover function
     * @param cName Name of the x group
     * @param groupObj Object to use to get values for the group
     * @returns {Function} A function that provides the values for the tooltip
     */
    function tooltipHover(cName, groupObj, event) {
        let tooltipString = '<span class="chart title">'+groupObj.title;
        if (groupObj.subtitle) {
            tooltipString += " "+groupObj.subtitle;
        }
        let selected = "";
        tooltipString += '</span><hr>Targets:'

        let target_total = 0;
        let target_string = ""
        for (const target of groupObj.metrics.targets) {
            if (event.name === target.name) {selected = "selected"}
            if (chart.settings.cumulativeTargets) {
                if (target.value > target_total) {target_total = target.value}
            } else {
                target_total += target.value
            }
            target_string += "<span class='"+selected+"'><span class='target title'>"+target.name+"</span> : <span class='target value '>"+chart.formatterValueToolTip(target.value)+"</span></span><br \>"
            selected = ""
        }
        if (groupObj.metrics.targets.length > 1) {
            tooltipString += " "+chart.formatterValueToolTip(target_total)+"<br \>"
        } else {
            tooltipString += "<br \>"
        }
        tooltipString += target_string

        for (const target of groupObj.metrics.targetsMarkers) {
            if (event.name === target.name) {selected = "selected"}
            tooltipString += "<span class='"+selected+"'><span class='target-metrics title '>> "+target.name+"</span> : <span class='target-metrics value '>"+chart.formatterValueToolTip(target.value)+"</span></span><br \>"
            selected = ""
        }

        tooltipString += '<hr>Results:'

        let result_total = 0;
        let result_string = ""
        for (const result of groupObj.metrics.results) {
            if (event.name === result.name) {selected = "selected"}
            if (chart.settings.cumulativeResults) {
                if (result.value > result_total) {result_total = +result.value}
            } else {
                result_total += +result.value
            }
            result_string += "<span class='"+selected+"'><span class='result title '>"+result.name+"</span> : <span class='result value '>"+chart.formatterValueToolTip(result.value)+" | "+chart.formatterPercent(result.percent_to_target)+"</span></span><br \>"
            selected = ""
        }
        if (groupObj.metrics.results.length > 1) {
            tooltipString += " "+chart.formatterValueToolTip(result_total)+"<br \>"
        } else {
            tooltipString += "<br \>"
        }
        tooltipString += result_string

        for (const result of groupObj.metrics.resultsMarkers) {
            if (event.name === result.name) {selected = "selected"}
            tooltipString += "<span class='"+selected+"'><span class='result-marketer title '>> "+result.name+"</span> : <span class='result-marker value '>"+chart.formatterValueToolTip(result.value)+" | "+chart.formatterPercent(result.percent_to_target)+"</span></span><br \>"
            selected = ""
        }
        return function () {

            chart.objs.tooltip.transition().duration(200);
            chart.objs.tooltip.html(tooltipString)
        };
    }

    /**
     * Prepare the chart settings and chart div and svg
     */
    !function prepareSettings() {
        chart.width = chart.settings.chartWidth;
        chart.height = (chart.settings.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults) + chart.settings.lowerSummaryPadding)
        chart.barWidth = chart.settings.chartWidth - chart.settings.titlePadding;
        if (chart.settings.constrainToTarget) {chart.barWidth -= chart.settings.constrainToTargetAdj}
        chart.barHeight = chart.settings.barHeight;
    }();

    function makeSafeForCSS(name) {
        // https://stackoverflow.com/a/7627603
        // Spaces and _ are replaces with -
        // Special characters are replaced with _
        // Uppercase is replaced with lowercase
        // If starts with a number, append an underscore
        if (!name) {return ''}
        name = name.replace(/[^a-z0-9-]/g, function(s) {
            var c = s.charCodeAt(0);
            if (c == 32 || c == 95) return '-';
            if (c >= 65 && c <= 90) return s.toLowerCase();
            return '_';
        });
        if (name.match(/^[0-9]/g)) {
            // css can't start with a number
            name = "_"+name
        }
        return name
    }

    /**
     * Read and prepare the raw data (no calculations based on ranges as those could change)
     */
    !function prepareData() {

        function roundUpNearest10(num) {
          return Math.round(Math.ceil(num / 10) * 10);
        }

        let valueSort = (a, b) => {
            if (a.value < b.value) return -1;
            if (a.value > b.value) return 1;
            return 0;
        }

        // Read the data from the columns
        let parseValues = (columnNames, current_row) => {
            let metricsObj = [];
            for (const column of columnNames) {
                let ref = column;
                let name = column;
                if (typeof column != 'string') {
                    ref = column[0];
                    name = column[1];
                }
                metricsObj.push({column: ref, name: name, value: chart.data[current_row][ref]});
                metricsObj.sort(valueSort);
            }
            return metricsObj;
        }

        function makechartObj(row, index){
            let chartObj = {
                title: "", // If null, the index will be used for internal sorting
                subtitle: null, // Can be null
                index: 0, // For order in presenting
                classes: [], // additional classes for formatting options
                svg: {parent:null,title:null,subtitle:null,targets:null,results:null,targetsMarkers:null,resultsMarkers:null},
                metrics : { //These are the original non-scaled values
                    targets: [],
                    results: [],
                    targetsMarkers: [],
                    resultsMarkers: [],
                    targetsMax: 0, // Largest value of the targets (for if constrain to target is true)
                    metricMax: 0 // Largest value of all metric values
                }
            }
            chartObj.index = index;

            if (typeof chart.settings.titleCols != 'string') {
                    chartObj.title = row[chart.settings.titleCols[0]];
                    chartObj.subtitle = row[chart.settings.titleCols[1]];
            } else {
                chartObj.title = row[chart.settings.titleCols];
            }

            chartObj.metrics.targets = parseValues(chart.settings.targetsCols, index);
            chartObj.metrics.targetsMarkers = parseValues(chart.settings.targetsMarkersCols, index);
            chartObj.metrics.results = parseValues(chart.settings.resultsCols, index);
            chartObj.metrics.resultsMarkers = parseValues(chart.settings.resultMarkersCols, index);
            chartObj.metrics.resultsLastIndex = chartObj.metrics.results.length - 1

            chartObj.metrics.targetsMax = !chart.settings.cumulativeTargets ? chartObj.metrics.targets.map(o => +o.value).reduce((a,b)=>a+b) : Math.max(...chartObj.metrics.targets.map(o => o.value)); // The largest target is used as the main target. Should this be more flexible?
            chartObj.metrics.targetsMarkersMax = Math.max(...chartObj.metrics.targetsMarkers.map(o => o.value));

            chartObj.metrics.resultsMax = !chart.settings.cumulativeResults ? chartObj.metrics.results.map(o => +o.value).reduce((a,b)=>a+b) : Math.max(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMin = Math.min(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMarkersMax = Math.max(...chartObj.metrics.resultsMarkers.map(o => o.value));
            chartObj.metrics.resultsMarkersMin = Math.min(...chartObj.metrics.resultsMarkers.map(o => o.value));

            chartObj.metrics.metricsMax = Math.max(chartObj.metrics.targetsMax, chartObj.metrics.resultsMax, chartObj.metrics.targetsMarkersMax, chartObj.metrics.resultsMarkersMax);

            // these are used to append classes for formatting in css
            // Calculate percent of max target for results
            chartObj.metrics.results.forEach(result => {
                result.percent_to_target = result.value / chartObj.metrics.targetsMax;
                });

            // Calculate percent of max target for results markers
            chartObj.metrics.resultsMarkers.forEach(result => {
                    result.percent_to_target = result.value / chartObj.metrics.targetsMax;
                });

            // Also the chart object itself gets a class append for the target to results
            chartObj.classes.push("p"+(roundUpNearest10((chartObj.metrics.resultsMax/chartObj.metrics.targetsMax)*100)).toString())

            return chartObj;
        }

        let current_obj = null;
        // Create objects for each row in the data
        for (let current_row = 0; current_row < chart.data.length; current_row++) {
            current_obj = makechartObj(chart.data[current_row], current_row);
            if (current_obj.title) chart.groupObjs[current_obj.title] = current_obj;
            else chart.groupObjs[current_obj.index.toString()] = current_obj;
        }
    }();

    /**
     * For each chartObj, calculate the relevant metrics that are affected by the size of the chart
     *  Range, width etc
     * @returns {*}
     */
    chart.update = function (groupObjs) {
        g = groupObjs;
        // Update Settings
        // chart.width = chart.settings.chartWidth // Width includes width of title text and space for end text
        // chart.height = (chart.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults))// - chart.margin.top - chart.margin.bottom;

        function calcMethods(metrics) {
            let methods = { //These are the functions to convert raw data to position
                xScale: null,
                widthCalc: null,
                calcPreviousTargetWidth: null,
                calcPreviousResultWidth: null
            };

            if (!chart.settings.constrainToTarget) {
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.metricsMax])
                    .range([0, chart.barWidth]);
            } else {
                // We want to keep all ranges at 100%, use the max target as 100%.
                // If this is the case, we may have ranges go over and will need to clamp the data.
                // with the constrainToTargetAdj setting, the max of the bar can be reduced by a percentage to give some space for data larger than the target
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.targetsMax]) // * (1+chart.settings.constrainToTargetAdj)
                    .range([0, chart.barWidth]);
            }

            // Calculate the difference from minScale (=0) to a number
            methods.calcWidth = ((scaleFunc) => {
                // Takes a scale function and gets the 0 position of scale
                // returns a function that gives the difference from the 0 value to "d" as the width
                var x0 = scaleFunc(0); // Position at value 0
                return (n) => {
                    return Math.abs(scaleFunc(n) - x0);
                };
            })(methods.xScale)

            const calcPreviousWidth = (scaleFunc, values, cumulative) => {
                return (n,i) => {
                    if (i > 0 && i <= values.length - 1 && cumulative) {
                        return Math.abs(scaleFunc(n.value) - scaleFunc(values[i - 1].value));
                    } else {
                        return methods.calcWidth(n.value);
                    }
                };
            }

            methods.calcPreviousTargetWidth = calcPreviousWidth(methods.xScale, metrics.targets, chart.settings.cumulativeTargets);
            methods.calcPreviousResultWidth = calcPreviousWidth(methods.xScale, metrics.results, chart.settings.cumulativeResults);

            methods.calcTargetMarkerX = (n) => {return methods.calcWidth(n.value)+chart.settings.titlePadding};
            methods.calcResultMarkerX = (n) => {return methods.calcWidth(n.value)+chart.settings.titlePadding};

            const calcPreviousX = (scaleFunc, values, cumulative) => {
                return function(d, i) {
                    let x = chart.settings.titlePadding;
                    if (i > 0 && i <= values.length - 1) {
                        return x + scaleFunc(values[i - 1].value);
                    } else {
                        return x;
                    }
                };
            }

            methods.calcPreviousTargetX = calcPreviousX(methods.xScale, metrics.targets, chart.settings.cumulativeTargets);
            methods.calcPreviousResultX = calcPreviousX(methods.xScale, metrics.results, chart.settings.cumulativeResults);

            const calcCumPreviousX = (scaleFunc, values) => {
                return function(d,i) {
                    let c = chart.settings.titlePadding;
                    if (i > 0 && i <= values.length - 1) {
                        // For cumulative need to add the previous x with the previous width. Not just the previous width
                        for (let j = i-1; j >= 0; j--) {
                            c += scaleFunc(values[j].value)
                        }
                        return c;
                    } else {
                        return c;
                    }
                };
            }

            methods.calcPreviousTargetX = chart.settings.cumulativeTargets ? calcPreviousX(methods.xScale, metrics.targets) : calcCumPreviousX(methods.xScale, metrics.targets);
            methods.calcPreviousResultX = chart.settings.cumulativeResults ? calcPreviousX(methods.xScale, metrics.results) : calcCumPreviousX(methods.xScale, metrics.results);

            // Formatting Methods

            // Targets
            methods.targetBarFormat = (d,i) => {
                let return_text = "target s" + i;
                let width = methods.calcPreviousTargetWidth(d, i);
                for (let i = 0; i <= Math.round(width); i+=25) {
                    return_text += " w"+`${i}`
                }
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return return_text;
            }

            methods.targetTextLabel = (d, i) => {
                // Wrapper function to keep the API the same and so custom formatters don't need to call d.value just d
                return chart.formatterValue(d.value);
            }

            methods.targetTextFormat = (d,i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 100, make the font size 12px -- class = less100
                // All this is done through returning certain css classes
                let return_text = "target text s" + i;
                return_text += " " + makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
            }

            methods.targetsYPos = (d,i) => {
                let y = 0;
                if (chart.settings.summarizeTargets) {y+=chart.barHeight}
                return y
            }

            // Results
            methods.resultBarFormat = (d,i) => {
                let return_text = "result s" + i;
                let width = methods.calcPreviousResultWidth(d, i);
                for (let i = 0; i <= Math.round(width) ; i+=25) {
                    return_text += " w"+`${i}`
                }
                for (let i = 0; i <= d.percent_to_target; i+=.1) {
                    return_text += " p"+`${Math.round(i*100)}`
                }
                if (i === metrics.resultsLastIndex) {
                    return_text += " last";
                }
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return_text += " "+makeSafeForCSS(d.column);
                return_text += " "+makeSafeForCSS(d.title);
                return return_text;
            }

            methods.resultTextLabel = (d, i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 75, don't show the percentage
                // If this is the last item, and it is more than 80%, Only show the number
                // d is the metric and i is the index of that item
                // let perc = d.value / metrics.targetsMax
                let return_text = chart.formatterValue(d.value);
                let width = methods.calcPreviousResultWidth(d, i);
                if (width >= chart.settings.minWidthForPercent) {
                    // Append percentage if there is room
                    return_text += " (" + chart.formatterPercent(d.percent_to_target) + ")";
                }
                return return_text;
            }

            methods.resultsOverflowCheck = (d,i) => {
                return (methods.calcPreviousResultWidth(d,i) + methods.calcPreviousResultX(d,i)) > (chart.barWidth - 100)
            }

            methods.resultTextXPos = (d,i) => {
                // If this is the last item, adjust the x to the end of the bar rather than on the bar.
                // Otherwise, find the middle of the bar, to do this we need the end of the previous bar and the end of this bar
                return "50%"
            }

            methods.resultTextYPos = (d,i) => {
                // If this is the last item, adjust the x to the end of the bar rather than on the bar.
                // Otherwise, find the middle of the bar, to do this we need the end of the previous bar and the end of this bar
                return "50%"
            }

            methods.resultsYPos = (d,i) => {
                let y = chart.barHeight;
                if (chart.settings.summarizeTargets) {y+=chart.barHeight}
                if (chart.settings.summarizeResults) {y+=chart.barHeight}
                return y
            }

            methods.resultTextFormat = (d,i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 100, make the font size 12px -- class = less100
                // If width is less than 40px, make invisible -- class = noshow
                // If last item, append class = last
                // All this is done through returning certain css classes
                let return_text = "result text s" + i;
                return return_text;
            }

            methods.resultsTextAlign = (d, i) => {
                // If it is the last item, align it to the left rather than the middle
                return "middle";
            }

            // Markers
            methods.targetMarkerFormat = (d, i) => {
                let return_text = "marker s" + i;
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
              };

            methods.resultMarkerFormat = (d, i) => {
                let return_text = "marker s" + i;
                for (let i = 0; i <= d.percent_to_target; i+=.1) {
                    return_text += " p"+`${Math.round(i*100)}`
                }
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
              };
            return methods;
            }

        function buildChartObj(chartObj) {
            // Update the target rectangles.

            chartObj.svg.targets = chartObj.g.append("g").attr("class","targets");

            let g = chartObj.svg.targets.selectAll("svg")
                .data(chartObj.metrics.targets)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width", chartObj.methods.calcPreviousTargetWidth)
                .attr("height", chart.barHeight)
                .attr("y", chartObj.methods.targetsYPos)
                .attr("x", chartObj.methods.calcPreviousTargetX)

            g.append("rect")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width","100%")
                .attr("height","100%")

            g.append("text")
                .attr("class", chartObj.methods.targetTextFormat)
                .attr("dy", '.1em')
                .attr("y","50%")
                .attr("x","50%")
                .attr("dominant-baseline","middle")
                .style("text-anchor", "middle")
                .text(function(d, i) {
                    return chartObj.methods.targetTextLabel(d);
                });
            let xtEnd = chartObj.svg.targets.node().getBBox().width + chart.settings.titlePadding;


            chartObj.svg.results = chartObj.g.append("g").attr("class","results");
            let r = chartObj.svg.results.selectAll("svg")
                .data(chartObj.metrics.results)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width", chartObj.methods.calcPreviousResultWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcPreviousResultX)
                .attr("y",chartObj.methods.resultsYPos)

            r.append("rect")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width","100%")
                .attr("height","100%")

            r.append("text")
                .attr("class", chartObj.methods.resultTextFormat)
                .attr("dy", '.1em')
                .attr("y",chartObj.methods.resultTextYPos)
                .attr("x",chartObj.methods.resultTextXPos)
                .attr("dominant-baseline","middle")
                .attr("text-anchor", chartObj.methods.resultsTextAlign)
                .text(function(d, i) {
                    return chartObj.methods.resultTextLabel(d,i);
                });

            let xEnd = chartObj.svg.results.node().getBBox().width + chart.settings.titlePadding;
            if (xEnd > chart.barWidth - 75) {
                chartObj.svg.results.append("text")
                    .attr("class", "summary")
                    .attr("dy", '.1em')
                    .attr("y", function(d, i) {return (chartObj.methods.resultsYPos(d,i)+chart.barHeight) + 4 }) // Halfway through the second bar (results bar)
                    .attr("x", xEnd)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "end")
                    .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")

            } else {
                chartObj.svg.results.append("text")
                    .attr("class", "summary")
                    .attr("dy", '.1em')
                    .attr("y", function(d, i) {return (chartObj.methods.resultsYPos(d,i)+chart.barHeight/2)}) // Halfway through the second bar (results bar)
                    .attr("x", xEnd + 5)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
            }

            // Update the marker lines.
           chartObj.svg.targetsMarkers = chartObj.g.append("g").attr("class","targets-markers");
            let tm = chartObj.svg.targetsMarkers.selectAll("svg")
                .data(chartObj.metrics.targetsMarkers)
                .enter()
                .append("line")
                .attr("class", chartObj.methods.targetMarkerFormat)
                .attr("x1", chartObj.methods.calcTargetMarkerX)
                .attr("x2", chartObj.methods.calcTargetMarkerX)
                .attr("y1", chartObj.methods.targetsYPos)
                .attr("y2", function(d,i) {
                    return chartObj.methods.targetsYPos(d,i)+chart.barHeight
                })

            chartObj.svg.resultsMarkers = chartObj.g.append("g").attr("class","results-markers");
            let rm = chartObj.svg.resultsMarkers.selectAll("svg")
                .data(chartObj.metrics.resultsMarkers)
                .enter()
                .append("line")
                .attr("class", chartObj.methods.resultMarkerFormat)
                .attr("x1", chartObj.methods.calcResultMarkerX)
                .attr("x2", chartObj.methods.calcResultMarkerX)
                .attr("y1", chartObj.methods.resultsYPos)
                .attr("y2", function(d,i) {
                    return chartObj.methods.resultsYPos(d,i)+chart.barHeight
                })

            if (chart.settings.summarizeTargets) {
                chartObj.svg.targetsSummary = chartObj.g.append("g").attr("class", "targets-summary");
                let ts = chartObj.svg.targetsSummary.append("svg")
                    .attr("class", "summary")
                    .attr("width", xtEnd - chart.settings.titlePadding)
                    .attr("height", chart.barHeight)
                    .attr("x", chart.settings.titlePadding)
                    .attr("y", "0")

                ts.append("rect")
                    .attr("class", "summary")
                    .attr("width", "100%")
                    .attr("height", "100%")

                if ((xtEnd - chart.settings.titlePadding) <= chart.settings.minWidthForPercent) {
                    // If the length of the bar won't fit the full percent metrics, put the label at the end
                    chartObj.svg.resultsSummary.append("text")
                        .attr("class", "summary")
                        .attr("dy", '.1em')
                        .attr("y", chart.barHeight * .5)
                        .attr("x", xtEnd + 5)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "start")
                        .text(chart.formatterValue(chartObj.metrics.targetsMax))
                } else {
                    ts.append("text")
                        .attr("dy", '.1em')
                        .attr("y", "50%")
                        .attr("x", "50%")
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .text(chart.formatterValue(chartObj.metrics.targetsMax))
                }
            }

            if (chart.settings.summarizeResults) {
                chartObj.svg.resultsSummary = chartObj.g.append("g").attr("class","results-summary");
                let rs = chartObj.svg.resultsSummary.append("svg")
                .attr("class", "summary")
                .attr("width", xEnd-chart.settings.titlePadding)
                .attr("height", chart.barHeight)
                .attr("x", chart.settings.titlePadding)
                .attr("y",function(d,i) {return chartObj.methods.targetsYPos(1,1)+chart.barHeight})

                rs.append("rect")
                .attr("class", "summary")
                .attr("width","100%")
                .attr("height","100%")

                if ((xEnd-chart.settings.titlePadding) <= chart.settings.minWidthForPercent) {
                    // If the length of the bar won't fit the full percent metrics, put the label at the end
                    chartObj.svg.resultsSummary.append("text")
                        .attr("class","summary")
                        .attr("dy", '.1em')
                        .attr("y",function(d,i) {return chartObj.methods.targetsYPos(1,1)+(chart.barHeight*1.5)})
                        .attr("x", xEnd+5)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "start")
                        .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
                } else {
                    rs.append("text")
                        .attr("dy", '.1em')
                        .attr("y", "50%")
                        .attr("x", "50%")
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
                }
            }

        return chartObj;
        }

        for (const p in groupObjs) {
            groupObjs[p].methods = calcMethods(groupObjs[p].metrics);
            buildChartObj(groupObjs[p]);
        }
    }


    /**
     * Prepare the chart html elements
     */
    !function prepareChart() {
        // Build main div and chart div
        chart.objs.mainDiv = d3.select(chart.settings.selector);

        // Add all the divs to make it centered and responsive
        chart.objs.mainDiv.append("div")
            .attr("class", "inner-wrapper")
            .append("div").attr("class", "outer-box")
            .append("div").attr("class", "inner-box").style("display","flex").style("flex-wrap","wrap");

        // Capture the inner div for the chart (where the chart actually is)
        chart.selector = chart.settings.selector + " .inner-box";
        chart.objs.chartDiv = d3.select(chart.selector);
        // Resize update hook
        // d3.select(window).on('resize.' + chart.selector, function() {chart.update(chart.groupObjs)});

        // Create the svg
        chart.objs.g = chart.objs.chartDiv.selectAll("div.chart-area")
            .data(chart.data)
            .enter()
            .append("div")
            .attr("class", "group pace-chart chart-area")
            .append("svg")
            .attr("width", chart.width)
            .attr("height", chart.height);

        chart.objs.titles = chart.objs.g.append("g")
          .style("text-anchor", "end")

        chart.objs.titles.append("text")
          .attr("class", "title")
          .attr("x","95")
          .attr("y",(chart.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults))/2)
          .text(function(d) {
            return d[chart.settings.titleCols[0]];
          });

        chart.objs.titles.append("text")
          .attr("class", "subtitle")
          .attr("dy", "1em")
          .attr("x","95")
          .attr("y",(chart.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults))/2)
          .text(function(d) {
            return d[chart.settings.titleCols[1]];
          });

        // Create tooltip div
        chart.objs.tooltip = chart.objs.mainDiv.append('div').attr('class', 'tooltip');

        // Create each chart divs
        chart.objs.g.each(
            function(g,i) {
                for (let cName in chart.groupObjs) {
                    if (cName === g[chart.settings.titleCols[0]]) {
                        // To make the dom elements easier to reference, add them to the chartObjects object
                        chart.groupObjs[cName].g = d3.select(this)
                        chart.groupObjs[cName].unique_id = "g"+i+"-"+Math.random().toString(16).slice(2); // Uniqueish ID
                        chart.groupObjs[cName].g.attr("class",makeSafeForCSS(chart.groupObjs[cName].title)+" "+makeSafeForCSS(chart.groupObjs[cName].subtitle));
                        chart.groupObjs[cName].g.attr("id",chart.groupObjs[cName].unique_id);
                        // Add the mouseover
                        chart.groupObjs[cName].g.on("mouseover", function (event, d) {
                            chart.objs.tooltip
                                .style("display", null)
                                .style("left", (event.pageX) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        }).on("mouseout", function () {
                            chart.objs.tooltip.style("display", "none");
                        }).on("mousemove", function(event, d) {
                            chart.objs.tooltip
                                .style("left", (event.pageX) + "px")
                                .style("top", (event.pageY - 28) + "px");
                            tooltipHover(cName, chart.groupObjs[cName], event.srcElement.__data__)()
                        })
                    }
                }
            }
        );

        chart.update(chart.groupObjs);
    }();

    return chart;
}
