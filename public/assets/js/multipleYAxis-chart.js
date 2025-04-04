function initializeYAxisChart() {
  var dom = document.getElementById('multipleYAxisChart');

  if (!dom) {
    return;
  }

  if (dom.clientWidth === 0 || dom.clientHeight === 0) {
    setTimeout(initializeYAxisChart, 100);
    return;
  }

  var myChart = echarts.init(dom, null, {
    renderer: 'canvas',
    useDirtyRect: false
  });

  const colors = ['#5470C6', '#91CC75', '#EE6666'];
  var option = {
    color: colors,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { right: '20%' },
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        restore: { show: true },
        saveAsImage: { show: true }
      }
    },
    legend: {
      data: ['Evaporation', 'Precipitation', 'Temperature'],
      left: '-5',
    },
    dataZoom: [
      {
        show: true,
        realtime: true,
        start: 65,
        end: 85
      },
      {
        type: 'inside',
        realtime: true,
        start: 65,
        end: 85
      }
    ],
    xAxis: [{
      type: 'category',
      axisTick: { alignWithLabel: true },
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }],
    yAxis: [
      {
        type: 'value',
        name: 'Evaporation',
        position: 'right',
        alignTicks: true,
        axisLine: { show: true, lineStyle: { color: colors[0] } },
        axisLabel: { formatter: '{value} ml' }
      },
      {
        type: 'value',
        name: 'Precipitation',
        position: 'right',
        alignTicks: true,
        offset: 80,
        axisLine: { show: true, lineStyle: { color: colors[1] } },
        axisLabel: { formatter: '{value} ml' }
      },
      {
        type: 'value',
        name: 'Temperature',
        position: 'left',
        alignTicks: true,
        axisLine: { show: true, lineStyle: { color: colors[2] } },
        axisLabel: { formatter: '{value} °C' }
      }
    ],
    series: [
      {
        name: 'Evaporation',
        type: 'bar',
        data: [2.0, 4.9, 7.0, 23.2, 25.6, 76.7, 135.6, 162.2, 32.6, 20.0, 6.4, 3.3]
      },
      {
        name: 'Precipitation',
        type: 'bar',
        yAxisIndex: 1,
        data: [2.6, 5.9, 9.0, 26.4, 28.7, 70.7, 175.6, 182.2, 48.7, 18.8, 6.0, 2.3]
      },
      {
        name: 'Temperature',
        type: 'line',
        yAxisIndex: 2,
        data: [2.0, 2.2, 3.3, 4.5, 6.3, 10.2, 20.3, 23.4, 23.0, 16.5, 12.0, 6.2]
      }
    ]
  };

  myChart.setOption(option);
  window.addEventListener('resize', () => myChart.resize());
}

// Ensure the DOM is loaded before initializing
document.addEventListener("DOMContentLoaded", () => {
  initializeYAxisChart();
});

// Wait for #multipleYAxisChart to have a valid size before initializing
const yAxisObserver = new MutationObserver(() => {
  var dom = document.getElementById('multipleYAxisChart');
  if (dom && dom.clientWidth > 0 && dom.clientHeight > 0) {
    initializeYAxisChart();
    yAxisObserver.disconnect(); // Stop observing once initialized
  }
});

// Start observing the body for changes (if the chart container is added dynamically)
yAxisObserver.observe(document.body, { childList: true, subtree: true });
