An implementation of a reusable responsive distribution chart. Based on the concept outlined in Mike Bostocks blog post [Towards Reusable Charts.](http://bost.ocks.org/mike/chart/)

Features:

* Responsive design, chart size adjusts with screen
* Easily styled in CSS
* Modular design supporting 3 types of charts
  * Box Plot
  * Notched Box Plot
  * Violin Plot
* Each chart type supports multiple options and styles such as
  * Box width
  * Show/Hide any component (median line, mean line, whiskers outliers, etc...)
  * Scatter Outliers
  * Notch style (traditional angled vs 90 degree cutouts)
  * Violin resolution and interpolation

Updated in V3
- Support for clamping the ViolinPlot or forcing it to extend beyond the normal range to create a closed Violin
- New option to adjust the number of y axis ticks

Previous version: [Reusable Violin + Box Plot V2](http://bl.ocks.org/asielen/1a5e8d77ae8feb464167)
