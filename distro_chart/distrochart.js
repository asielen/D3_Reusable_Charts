function makeDistroChart(dataset, xGroup, yValue) {
    /*
    * dataset = the csv file
    * xGroup = the name of the column to group by
    * yValue = the column to use as the values for the chart
    * axisLabels = Labels for the chart
    * options = list of chart options
    *   scale = linear (vs log)
    *   chartSize
    *   – chart_width = 650
    *   – chart_height = 480
    *   – ratio = chart_height/chart_width <– this is the actual number used in the
    *   margin = {top: 15, right: 60, bottom: 30, left: 50};
    *
    * */

    var chartObj = {};
    var color = d3.scale.category10();

    function formatAsFloat(d) {
        if (d % 1 !== 0) {
            return d3.format(".2f")(d);
        } else {
            return d3.format(".0f")(d);
        }

    }
    function logFormatNumber (d) {
        var x = Math.log(d) / Math.log(10) + 1e-6;
        return Math.abs(x - Math.floor(x)) < 0.6 ? formatAsFloat(d) : "";
    }
    chartObj.yFormatter = formatAsFloat;

    chartObj.data = dataset;
    chartObj.svg = null;

    //Data management
    chartObj.xGroup = xGroup;
    chartObj.yValue = yValue;
    chartObj.dataObjects = {}; //The data organized by grouping and sorted as well as any metadata for the groups
    (function () {
        /*
        * Takes the dataset that is an array of objects and groups the yValues by xGroups and then sorts it
        * Returns the dataObject
        * */
        var current_x = null;
        var current_y = null;
        var current_row;

        //Group the values
        for (current_row = 0; current_row < chartObj.data.length; current_row++) {
            current_x = chartObj.data[current_row][chartObj.xGroup];
            current_y = chartObj.data[current_row][chartObj.yValue];
            if (chartObj.dataObjects.hasOwnProperty(current_x)) {
                chartObj.dataObjects[current_x].values.push(current_y);
            } else {
                chartObj.dataObjects[current_x] = {};
                chartObj.dataObjects[current_x].values = [current_y];
            }
        }

        var current_group;
        // Sort them
        for  (current_group in chartObj.dataObjects) {
            chartObj.dataObjects[current_group].values.sort(d3.ascending);
        }
    })();

    chartObj.updateChart = function () {
        //Base
        if (!chartObj.svg) {return false;}
        // Update size
        chartObj.width = parseInt(chartObj.chartDiv.style("width"), 10) - (chartObj.margin.left + chartObj.margin.right);
        chartObj.height = parseInt(chartObj.chartDiv.style("height"), 10) - (chartObj.margin.top + chartObj.margin.bottom);
        chartObj.xScale.rangeBands([0, chartObj.width]);
        chartObj.yScale.range([chartObj.height, 0]);
        //Updae axes
        chartObj.svg.select('.x.axis').attr("transform", "translate(0," + chartObj.height + ")").call(chartObj.xAxis);
        chartObj.svg.select('.x.axis .label').attr("x", chartObj.width / 2);
        chartObj.svg.select('.y.axis').call(chartObj.yAxis);
        chartObj.svg.select('.y.axis .label').attr("x", -chartObj.height / 2);
        chartObj.chartDiv.select('svg').attr("width", chartObj.width + (chartObj.margin.left + chartObj.margin.right)).attr("height", chartObj.height + (chartObj.margin.top + chartObj.margin.bottom));

        //Violin


        return chartObj;
    };

    chartObj.bind = function (selector, options) {
        /*
        * Setup chart and connect it to the correct div
        *  – Selector is the id to attach the chart to
        *  – chartSize is height and width of the div
        *  – margin is the margins around the div
        *  Todo: imppliment inclOutlier for min/max setup
        *  Todo: legend options or data labels
        *  - showLegend True/False
        *  - showXLables True/False
        *  options = {chartSize, margin, axisLabels, scale}
         */

        //Get base data
        (function(){
            if (options && options.margin) {
                chartObj.margin = margin;
            } else {
                chartObj.margin = {top: 15, right: 60, bottom: 10, left: 50};
            }
            if (options && options.chartSize) {
                chartObj.divWidth = chartSize.width;
                chartObj.divHeight = chartSize.height;
            } else {
                chartObj.divWidth = 650;
                chartObj.divHeight = 325;
            }

            chartObj.width = chartObj.divWidth - chartObj.margin.left - chartObj.margin.right;
            chartObj.height = chartObj.divHeight - chartObj.margin.top - chartObj.margin.bottom;

            if (options && options.axisLabels) {
                chartObj.xAxisLable = axisLabels.xAxis;
                chartObj.yAxisLable = axisLabels.yAxis;
            } else {
                chartObj.xAxisLable = xGroup;
                chartObj.yAxisLable = yValue;
            }
            if (options && options.scale === 'log') {
                chartObj.yScale = d3.scale.log();
                chartObj.yFormatter = logFormatNumber;
            } else {
                chartObj.yScale = d3.scale.linear();
            }
            chartObj.range = d3.extent(chartObj.data, function(d){return d[chartObj.yValue]; });
            chartObj.yScale.range([chartObj.height, 0]).domain(chartObj.range);
            // Get x range
            chartObj.xScale = d3.scale.ordinal().domain(Object.keys(chartObj.dataObjects)).rangeBands([0, chartObj.width]);
            //Build Axes
            chartObj.yAxis = d3.svg.axis()
                .scale(chartObj.yScale)
                .orient("left")
                .tickFormat(chartObj.yFormatter)
                .tickSize(0);
            chartObj.xAxis = d3.svg.axis().scale(chartObj.xScale).tickFormat('').tickSize(10).orient("bottom");

        })();

        // Capture the main div for the chart
        chartObj.mainDiv = d3.select(selector);
        // Add all the divs to make it centered and responsive
        chartObj.mainDiv.append("div").attr("class", "inner-wrapper").append("div").attr("class", "outer-box").append("div").attr("class", "inner-box");
        // Capture the inner div for the chart (where the chart actually is)
        chartObj.chartSelector = selector + " .inner-box";
        chartObj.chartDiv = d3.select(chartObj.chartSelector);
        d3.select(window).on('resize.' + chartObj.chartSelector, chartObj.updateChart);

        // Create the svg
        chartObj.svg = chartObj.chartDiv.append("svg")
            .attr("class", "chart-area")
            .attr("width", chartObj.width + (chartObj.margin.left + chartObj.margin.right))
            .attr("height", chartObj.height + (chartObj.margin.top + chartObj.margin.bottom))
            .append("g")
                .attr("transform", "translate(" + chartObj.margin.left + "," + chartObj.margin.top + ")");

        // Show axis
        chartObj.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + chartObj.height + ")")
            .call(chartObj.xAxis);
        chartObj.svg.append("g")
            .attr("class", "y axis")
            .call(chartObj.yAxis)
            .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", -42)
                .attr("x", -chartObj.height / 2)
                .attr("dy", ".71em")
                .style("text-anchor", "middle")
                .text(chartObj.yAxisLable);

        // Create legend
        var legend = chartObj.mainDiv.append('div').attr("class", "legend");
        var cGroup, series;
        for (cGroup in chartObj.dataObjects) {
            series = legend.append('div').style("width",136+"px");
            series.append('div').attr("class", "series-marker").style("background-color", color(cGroup));
            series.append('p').text(cGroup);
            chartObj.dataObjects[cGroup].legend = series;
        }
        chartObj.updateChart();

        return chartObj;
    };

    chartObj.renderViolinPlot = function(options) {
        /*
        * Needs to take into account scales (lin/log)
        * Possible options
        *
         */
        chartObj.violinPlots = {};
        chartObj.violinPlots.plots = {};

        // Violin Calculations
        chartObj.violinPlots.calculateNumBins = function(cGroup){
            var iqr;
            if (chartObj.boxPlots) {
                iqr = chartObj.boxPlots.plots[cGroup].values.iqr
            } else {
                var quartile1 = d3.quantile(chartObj.dataObjects[cGroup].values, 0.25);
                var quartile3 = d3.quantile(chartObj.dataObjects[cGroup].values, 0.75);
                iqr = quartile3 - quartile1;
            }
            return Math.round(2 * (iqr / Math.pow(chartObj.dataObjects[cGroup].values.length,1/3)))
        };

        function calculateViolinPlotValues() {
            /*
             * Takes the structured data and calculates the box plot numbers
             * */

            var cGroup, cViolinPlot, width = chartObj.xScale.rangeBand()/3;

            for (cGroup in chartObj.dataObjects) {
                chartObj.violinPlots.plots[cGroup] = {};
                cViolinPlot = chartObj.violinPlots.plots[cGroup];

                cViolinPlot.histogramData = d3.layout.histogram()
                    .bins(chartObj.violinPlots.calculateNumBins(cGroup))
                    .frequency(1)(chartObj.dataObjects[cGroup].values);

                var xV = chartObj.yScale.copy();
                xV.range([chartObj.height, 0]).nice();
                var imposeMax = 0; // Should be able to set through options
                var yV = d3.scale.linear()
                    .range([width, 0])
                    .domain([0, Math.max(imposeMax, d3.max(cViolinPlot.histogramData, function(d) { return d.y; }))]);

                cViolinPlot.area = d3.svg.area()
                    .interpolate('basis')
                    .x(function(d) {return xV(d.x);})
                    .y0(width)
                    .y1(function(d) { return yV(d.y);});

                cViolinPlot.line = d3.svg.line()
                    .interpolate('basis')
                    .x(function(d) { return xV(d.x);})
                    .y(function(d) { return yV(d.y);});

                cViolinPlot.gPlus = chartObj.svg.append("g");
                cViolinPlot.gMinus = chartObj.svg.append("g");

                cViolinPlot.gPlus.append("path")
                  .datum(cViolinPlot.histogramData)
                  .attr("class", "area")
                  .attr("d", cViolinPlot.area)
                  .style("fill", color(cGroup));

                cViolinPlot.gPlus.append("path")
                  .datum(cViolinPlot.histogramData)
                  .attr("class", "violin")
                  .attr("d", cViolinPlot.line)
                    .attr("fill",'none')
                  .style("stroke", color(cGroup));

                cViolinPlot.gMinus.append("path")
                  .datum(cViolinPlot.histogramData)
                  .attr("class", "area")
                  .attr("d", cViolinPlot.area)
                  .style("fill", color(cGroup));

                cViolinPlot.gMinus.append("path")
                  .datum(cViolinPlot.histogramData)
                  .attr("class", "violin")
                  .attr("d", cViolinPlot.line)
                    .attr("fill",'none')
                  .style("stroke", color(cGroup));

                var rightBound = chartObj.xScale(cGroup) + (chartObj.xScale.rangeBand()-width/2);
                var leftBound = chartObj.xScale(cGroup) + width/2;

                cViolinPlot.gPlus.attr("transform", "rotate(90,0,0)  translate(0,-"+rightBound+")");
                cViolinPlot.gMinus.attr("transform", "rotate(90,0,0)   translate(0,-"+leftBound+")  scale(1,-1)");
            }
        }
        calculateViolinPlotValues();

        return chartObj.violinPlots;
    };

    chartObj.renderBoxPlot = function(options) {
        chartObj.boxPlots = {};
        chartObj.boxPlots.plots = {};
        /*
        * options:
        *   showOutliers: True/False (default True) - this shouldn't  affect the min/max
        *   showWhiskers: True/False (default True)
        *   whiskersRatio: (default standard=iqr*1.5), other options, minmax, (future?: std)
        *   showBox: True/False (default True)
        *   showMedian: True/False  (default True)
        *   showMean: True/False (default False)
        *   outlierScatter: True/False (default False) (not fully implimented)
         */

        // Boxplot Calculations
        function calculateBoxPlotValues() {
            /*
             * Takes the structured data and calculates the box plot numbers
             * */
            var cGroup, cBoxPlotValues, cValues;

            for (cGroup in chartObj.dataObjects) {
                //chartObj.dataObjects[cGroup].boxPlot = {};
                chartObj.boxPlots.plots[cGroup] = {};
                cBoxPlot = chartObj.boxPlots.plots[cGroup];
                cBoxPlot.objs = {}; // This contains the outliers and extremes for a box plot, it is separate from the values/divs because points have to be treated differently
                cBoxPlot.sValues =  {}; // Will hold the scaled values
                cBoxPlot.values = { //These are the original non–scaled values
                    max: null,
                    upperOuterFence: null,
                    upperInnerFence: null,
                    quartile3: null,
                    median: null,
                    mean: null,
                    iqr: null,
                    quartile1: null,
                    lowerInnerFence: null,
                    lowerOuterFence: null,
                    min: null
                };

                cValues = chartObj.dataObjects[cGroup].values;

                cBoxPlot.values.min = d3.min(cValues);
                cBoxPlot.values.quartile1 = d3.quantile(cValues, 0.25);
                cBoxPlot.values.median = d3.median(cValues);
                cBoxPlot.values.mean = d3.mean(cValues);
                cBoxPlot.values.quartile3 = d3.quantile(cValues, 0.75);
                cBoxPlot.values.max = d3.max(cValues);

                cBoxPlot.values.iqr = cBoxPlot.values.quartile3 - cBoxPlot.values.quartile1;

                //The inner fences are the closest value to the IQR without going past it (assumes sorted lists)
                if (!options || (options && (!options.whiskerRatio || options.whiskerRatio === "standard"))) {
                    var LIF = cBoxPlot.values.quartile1 - (1.5 * cBoxPlot.values.iqr);
                    var UIF = cBoxPlot.values.quartile3 + (1.5 * cBoxPlot.values.iqr);
                    for (var i = 0; i <= cValues.length; i++) {
                        if (cValues[i] < LIF) {continue;}
                        if (!cBoxPlot.values.lowerInnerFence && cValues[i] >= LIF) {
                            cBoxPlot.values.lowerInnerFence = cValues[i];
                            continue;
                        }
                        if (cValues[i] > UIF) {
                            cBoxPlot.values.upperInnerFence = cValues[i - 1];
                            break;
                        }
                    }
                }
                cBoxPlot.values.lowerOuterFence = cBoxPlot.values.quartile1 - (3 * cBoxPlot.values.iqr);
                cBoxPlot.values.upperOuterFence = cBoxPlot.values.quartile3 + (3 * cBoxPlot.values.iqr);
                if (!cBoxPlot.values.lowerInnerFence) {cBoxPlot.values.lowerInnerFence = cBoxPlot.values.min;}
                if (!cBoxPlot.values.upperInnerFence) {cBoxPlot.values.upperInnerFence = cBoxPlot.values.max;}
            }
        }
        calculateBoxPlotValues();

        function calculateBoxPlotOutliers() {
            /*
            * Create lists of the outliers for each content group
             */
            var cOutliers, cExtremes, cGroupValues, cBoxPlot, cOut, idx, cGroup;

            for (cGroup in chartObj.boxPlots.plots)  {
                cExtremes = [];
                cOutliers = [];
                cBoxPlot = chartObj.boxPlots.plots[cGroup];
                cGroupValues = chartObj.dataObjects[cGroup].values;
                for (idx = 0; idx <= cGroupValues.length; idx++) {
                    // We need to store both the original and the scaled
                    //  the original so we can rescale later
                    //  the scaled to save some time later
                    cOut = {value:cGroupValues[idx]};

                    if (cOut.value < cBoxPlot.values.lowerInnerFence) {
                        if (cOut.value < cBoxPlot.values.lowerOuterFence) {
                            cExtremes.push(cOut);
                        } else {
                            cOutliers.push(cOut);
                        }
                    } else if (cOut.value > cBoxPlot.values.upperInnerFence) {
                        if (cOut.value > cBoxPlot.values.upperOuterFence) {
                            cExtremes.push(cOut);
                        } else {
                            cOutliers.push(cOut);
                        }
                    }
                }
                cBoxPlot.objs.outliers = cOutliers;
                cBoxPlot.objs.extremes = cExtremes;

            }
        }
        if (!options || (options && options.showOutliers !== false)) {
            calculateBoxPlotOutliers();
        } else {
            // If we are not showing outliers, recalculate the max and min of the chart without them
            var tempRangeValues = [];
            for (cGroup in chartObj.boxPlots.plots) {
                tempRangeValues.push(chartObj.boxPlots.plots[cGroup].values.lowerInnerFence);
                tempRangeValues.push(chartObj.boxPlots.plots[cGroup].values.upperInnerFence);
            }
            chartObj.range = d3.extent(tempRangeValues);
            chartObj.yScale.domain(chartObj.range);
        }

        chartObj.boxPlots.updateChart = function () {
            //Boxplot
            var cGroup, cBoxPlot;
            for (cGroup in chartObj.boxPlots.plots) {
                cBoxPlot = chartObj.boxPlots.plots[cGroup];
                var leftBound = chartObj.xScale(cGroup) + chartObj.xScale.rangeBand() / 3;
                var rightBound = leftBound + chartObj.xScale.rangeBand() / 3;
                var middle = chartObj.xScale(cGroup) + chartObj.xScale.rangeBand() / 2;
                
                for (var attr in cBoxPlot.values) {
                    cBoxPlot.sValues[attr] = chartObj.yScale(cBoxPlot.values[attr]);
                }
                
                //// Box
                if (cBoxPlot.divs.box) {
                    cBoxPlot.divs.box
                        .attr("x", leftBound)
                        .attr('width', rightBound - leftBound)
                        .attr("y", cBoxPlot.sValues.quartile3)
                        .attr("rx",1)
                        .attr("ry",1)
                        .attr("height", -cBoxPlot.sValues.quartile3 + cBoxPlot.sValues.quartile1)
                }
                //// Lines
                if (cBoxPlot.divs.whiskers) {
                    cBoxPlot.divs.whiskers.upperFence
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', cBoxPlot.sValues.upperInnerFence)
                        .attr("y2", cBoxPlot.sValues.upperInnerFence);
                    cBoxPlot.divs.whiskers.upperLine
                        .attr("x1", middle)
                        .attr("x2", middle)
                        .attr('y1', cBoxPlot.sValues.quartile3)
                        .attr("y2", cBoxPlot.sValues.upperInnerFence);

                    cBoxPlot.divs.whiskers.lowerFence
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', cBoxPlot.sValues.lowerInnerFence)
                        .attr("y2", cBoxPlot.sValues.lowerInnerFence);
                    cBoxPlot.divs.whiskers.lowerLine
                        .attr("x1", middle)
                        .attr("x2", middle)
                        .attr('y1', cBoxPlot.sValues.quartile1)
                        .attr("y2", cBoxPlot.sValues.lowerInnerFence);
                }
                //// Median
                if (cBoxPlot.divs.median) {
                    cBoxPlot.divs.median.line
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', cBoxPlot.sValues.median)
                        .attr("y2", cBoxPlot.sValues.median);
                    cBoxPlot.divs.median.circle
                        .attr("cx", middle)
                        .attr("cy", cBoxPlot.sValues.median)
                }

                //// Mean
                if (cBoxPlot.divs.mean) {
                    cBoxPlot.divs.mean.line
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', cBoxPlot.sValues.mean)
                        .attr("y2", cBoxPlot.sValues.mean);
                    cBoxPlot.divs.mean.circle
                        .attr("cx", middle)
                        .attr("cy", cBoxPlot.sValues.mean);
                }
                //// Outliers
                var pt;
                if (cBoxPlot.objs.outliers) {
                    for (pt in cBoxPlot.objs.outliers) {
                        cBoxPlot.objs.outliers[pt].point
                            .attr("cx", middle/*+scatter()*/)
                            .attr("cy", chartObj.yScale(cBoxPlot.objs.outliers[pt].value));
                    }
                }
                if (cBoxPlot.objs.extremes) {
                    for (pt in cBoxPlot.objs.extremes) {
                        cBoxPlot.objs.extremes[pt].point
                            .attr("cx", middle/*+scatter()*/)
                            .attr("cy", chartObj.yScale(cBoxPlot.objs.extremes[pt].value));
                    }
                }
            }
        };

        // Map everything to divs
        var cGroup, cBoxPlot;
        for (cGroup in  chartObj.boxPlots.plots) {
            cBoxPlot = chartObj.boxPlots.plots[cGroup];
            cBoxPlot.divs = {
                box: null,
                whiskers: null, /*{upperFence:null,  upperLine:null, lowerFence:null, lowerLine:null}*/
                median: null,   /*{line:null, circle:null}*/
                mean: null,     /*{line:null, circle:null}*/
                outliers: null,
                extremes: null
            };
            //cBoxPlot.values.leftBound = chartObj.xScale(cGroup) + chartObj.xScale.rangeBand() / 3;
            //cBoxPlot.values.rightBound = cBoxPlot.values.leftBound + chartObj.xScale.rangeBand() / 3;
            //cBoxPlot.values.middle = chartObj.xScale(cGroup) + chartObj.xScale.rangeBand() / 2;

            //Plot Box (default show)
            if (!options || (options && options.showBox !== false)) {
                cBoxPlot.divs.box = chartObj.svg.append("rect")
                    .attr("class", "boxplot fill")
                    .style("fill", color(cGroup));
            }

            //Plot Median (default show)
            if (!options || (options && options.showMedian !== false)) {
                cBoxPlot.divs.median = {line:null, circle:null};
                cBoxPlot.divs.median.line = chartObj.svg.append("line")
                    .attr("class", "median");
                cBoxPlot.divs.median.circle = chartObj.svg.append("circle")
                    .attr("class", "median")
                    .attr('r',3)
                    .style("fill", color(cGroup));
            }

            // Plot Mean (default no plot)
            if (options && options.showMean) {
                cBoxPlot.divs.mean = {line:null, circle:null};
                cBoxPlot.divs.mean.line = chartObj.svg.append("line")
                    .attr("class", "mean");
                cBoxPlot.divs.mean.circle = chartObj.svg.append("circle")
                    .attr("class", "mean")
                    .attr('r',3)
                    .style("fill", color(cGroup));
            }

            //Plot Whiskers (default show)
            if (!options || (options && options.showWhiskers !== false)) {
                cBoxPlot.divs.whiskers = {upperFence:null,  upperLine:null, lowerFence:null, lowerLine:null};
                cBoxPlot.divs.whiskers.upperFence = chartObj.svg.append("line")
                    .attr("class", "upper whisker")
                    .style("stroke", color(cGroup));
                cBoxPlot.divs.whiskers.upperLine = chartObj.svg.append("line")
                    .attr("class", "upper whisker")
                    .style("stroke", color(cGroup));

                cBoxPlot.divs.whiskers.lowerFence = chartObj.svg.append("line")
                    .attr("class", "lower whisker")
                    .style("stroke", color(cGroup));
                cBoxPlot.divs.whiskers.lowerLine = chartObj.svg.append("line")
                    .attr("class", "lower whisker")
                    .style("stroke", color(cGroup));
            }

            // Plot outliers (default show)
            //var scatter = function() {
            //    var range = chartObj.xScale.rangeBand()/3;
            //    return Math.floor(Math.random() * range)-range/2;
            //}
            if (!options || (options && options.showOutliers !== false)) {
                var pt;
                if (cBoxPlot.objs.outliers.length) {
                    for (pt in cBoxPlot.objs.outliers) {
                         cBoxPlot.objs.outliers[pt].point = chartObj.svg.append("circle")
                            .attr("class", "outlier")
                             .attr('r',2)
                            .style("fill", color(cGroup));
                    }
                }
                if (cBoxPlot.objs.extremes.length) {
                    for (pt in cBoxPlot.objs.extremes) {
                        cBoxPlot.objs.extremes[pt].point = chartObj.svg.append("circle")
                            .attr("class", "extreme")
                            .attr('r',2)
                            .style("stroke", color(cGroup));
                    }
                }
            }

        }

        d3.select(window).on('resize.' + chartObj.chartSelector+'.boxPlot', chartObj.boxPlots.updateChart);
        //Update the divs with the proper values
        chartObj.boxPlots.updateChart();
        return chartObj.boxPlots;
    };

    return chartObj;
}
