function makeDistroChart(dataset, xGroup, yValue, axisLabels, options) {
    /*
    * dataset = the csv file
    * xGroup = the name of the column to group by
    * yValue = the column to use as the values for the chart
    * axisLabels = Labels for the chart
    * options = list of chart options
    *   group_padding = 5px; // maybe not needed
    *   scale = linear (vs log)
    *   TBD:
    *   chart_width = 650
    *   chart_height = 480
    *   margins = {top: 15, right: 60, bottom: 30, left: 50};
    *
    * */

    var chartObj = {};
    chartObj.data = dataset;
    chartObj.svg = null;
    chartObj.options = options;

    //var color = d3.scale.category10();
    chartObj.margin = {top: 15, right: 60, bottom: 30, left: 50};

    chartObj.divWidth = 650;
    chartObj.width = chartObj.divWidth - chartObj.margin.left - chartObj.margin.right;
    chartObj.divHeight = 325;
    chartObj.height = chartObj.divHeight - chartObj.margin.top - chartObj.margin.bottom;
    chartObj.xAxisLable = axisLabels.xAxis;
    chartObj.yAxisLable = axisLabels.yAxis;

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

    // Basic Chart
    // Get y range
    chartObj.range = d3.extent(chartObj.data, function(d){return d[chartObj.yValue]; });
    if (chartObj.hasOwnProperty('scale') && chartObj.scale == 'log') {
         chartObj.yScale = d3.scale.log();
    } else {
        chartObj.yScale = d3.scale.linear();
    }
    chartObj.yScale.range([chartObj.height, 0]).domain(chartObj.range);
    // Get x range
    chartObj.xScale = d3.scale.ordinal().domain(Object.keys(chartObj.dataObjects)).rangePoints([0, chartObj.width],1);
    //Build Axi
    chartObj.yAxis = d3.svg.axis().scale(chartObj.yScale).orient("left");
    chartObj.xAxis = d3.svg.axis().scale(chartObj.xScale).tickValues(Object.keys(chartObj.dataObjects)).orient("bottom");


    chartObj.updateChartSize = function () {return chartObj; };

    chartObj.bind = function (selector) {
        // Capture the main div for the chart
        chartObj.mainDiv = d3.select(selector);
        // Add all the divs to make it centered and responsive
        chartObj.mainDiv.append("div").attr("class", "inner-wrapper").append("div").attr("class", "outer-box").append("div").attr("class", "inner-box");
        // Capture the inner div for the chart (where the chart actually is)
        var chartSelector = selector + " .inner-box";
        chartObj.chartDiv = d3.select(chartSelector);
        d3.select(window).on('resize.' + chartSelector, chartObj.update_svg_size);

        // Create the svg
        chartObj.svg = chartObj.chartDiv.append("svg").attr("class", "chart-area").attr("width", chartObj.width + (chartObj.margin.left + chartObj.margin.right)).attr("height", chartObj.height + (chartObj.margin.top + chartObj.margin.bottom)).append("g").attr("transform", "translate(" + chartObj.margin.left + "," + chartObj.margin.top + ")");
        chartObj.updateChartSize();

        //Render Base
        (function () {
        // Show axis
        chartObj.svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + chartObj.height + ")").call(chartObj.xAxis);
        chartObj.svg.append("g").attr("class", "y axis").call(chartObj.yAxis).append("text").attr("class", "label").attr("transform", "rotate(-90)").attr("y", -42).attr("x", -chartObj.height / 2).attr("dy", ".71em").style("text-anchor", "middle").text(chartObj.yAxisLable);
        })();

        return chartObj;
    };


    chartObj.renderViolin = function() {return chartObj;};
    chartObj.renderBoxPlot = function() {

        function calculateBoxPlotValues() {
            /*
            * Takes the structured data and calculates the box plot numbers
            * */
            var current_group;
            var current_boxplot;
            var current_values;

            for (current_group in chartObj.dataObject) {
                chartObj.dataObjects[current_group].boxPlotValues =    {max: null, upperOuterFence: null, upperInnerFence: null,
                                                            quartile3: null,  median: null, iqr: null, quartile1: null,
                                                            lowerInnerFence: null, lowerOuterFence: null, min: null};
                current_boxplot = chartObj.dataObjects[current_group].boxPlotValues;
                current_values = chartObj.dataObjects[current_group].values;

                current_boxplot.min = d3.min(current_values);
                current_boxplot.quartile1 = d3.quantile(current_values, 0.25);
                current_boxplot.median = d3.median(current_values);
                current_boxplot.quartile3 = d3.quantile(current_values, 0.75);
                current_boxplot.max = d3.max(current_values);

                current_boxplot.iqr = current_boxplot.quartile3 - current_boxplot.quartile1;

                current_boxplot.lowerOuterFence = current_boxplot.quartile1 - (3 * current_boxplot.iqr);
                current_boxplot.lowerInnerFence = current_boxplot.quartile1 - (1.5 * current_boxplot.iqr);
                current_boxplot.upperInnerFence = current_boxplot.quartile3 + (1.5 * current_boxplot.iqr);
                current_boxplot.upperOuterFence = current_boxplot.quartile3 + (3 * current_boxplot.iqr);

                console.log(current_boxplot);
            }
        }
        calculateBoxPlotValues();


        return chartObj;

    };
    return chartObj;
}
