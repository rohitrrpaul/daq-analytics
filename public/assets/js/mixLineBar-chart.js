function initializeMixLineBarChart() {
  var dom = document.getElementById('mixLineBarChart');

  if (!dom) {
    
    return;
  }

  if (dom.clientWidth === 0 || dom.clientHeight === 0) {
    
    setTimeout(initializeMixLineBarChart, 100);
    return;
  }

  var myChart = echarts.init(dom, null, {
    renderer: 'canvas',
    useDirtyRect: false
  });

  var option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#999' }
      }
    },
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true }
      }
    },
    legend: {
      data: ['Evaporation', 'Precipitation', 'Temperature'],
      left: '0'
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
    xAxis: [
      {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisPointer: { type: 'shadow' }
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: 'Precipitation',
        min: 0,
        max: 250,
        interval: 50,
        axisLabel: { formatter: '{value} ml' }
      },
      {
        type: 'value',
        name: 'Temperature',
        min: 0,
        max: 25,
        interval: 5,
        axisLabel: { formatter: '{value} °C' }
      }
    ],
    series: [
      {
        name: 'Evaporation',
        type: 'bar',
        tooltip: {
          valueFormatter: (value) => value + ' ml'
        },
        data: [2.0, 4.9, 7.0, 23.2, 25.6, 76.7, 135.6, 162.2, 32.6, 20.0, 6.4, 3.3]
      },
      {
        name: 'Precipitation',
        type: 'bar',
        tooltip: {
          valueFormatter: (value) => value + ' ml'
        },
        data: [2.6, 5.9, 9.0, 26.4, 28.7, 70.7, 175.6, 182.2, 48.7, 18.8, 6.0, 2.3]
      },
      {
        name: 'Temperature',
        type: 'line',
        yAxisIndex: 1,
        tooltip: {
          valueFormatter: (value) => value + ' °C'
        },
        data: [2.0, 2.2, 3.3, 4.5, 6.3, 10.2, 20.3, 23.4, 23.0, 16.5, 12.0, 6.2]
      }
    ]
  };

  myChart.setOption(option);
  window.addEventListener('resize', () => myChart.resize());
}

// Ensure the DOM is loaded before initializing
document.addEventListener("DOMContentLoaded", () => {
  initializeMixLineBarChart();
});

// Observe size changes to #mixLineBarChart and initialize when ready
const mixLineBarObserver = new MutationObserver(() => {
  var dom = document.getElementById('mixLineBarChart');
  if (dom && dom.clientWidth > 0 && dom.clientHeight > 0) {
    initializeMixLineBarChart();
    mixLineBarObserver.disconnect(); // Stop observing once initialized
  }
});

// Start observing the body for changes (if the chart container is added dynamically)
mixLineBarObserver.observe(document.body, { childList: true, subtree: true });
