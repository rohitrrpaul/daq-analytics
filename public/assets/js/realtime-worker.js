self.onmessage = function (e) {
    const { mappings, interval } = e.data;
  
    function getRandomValue(min = 0, max = 100) {
      return (Math.random() * (max - min) + min).toFixed(2);
    }
  
    setInterval(() => {
      const now = new Date();
      const date = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const time = now.toTimeString().split(' ')[0].slice(0, 5);
  
      const values = mappings.map((m) => ({
        annotation: m.annotation,
        value: getRandomValue(-100, 500)
      }));
  
      self.postMessage({ date, time, values });
    }, interval);
  };  