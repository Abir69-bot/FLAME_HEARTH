/* Pure browser copies of real rules. tests/blueprint.test.ts checks they match lib/physics.ts. */
var BPLogic = {
  pO2: function (o2, p) {
    return Math.round(((o2 / 100) * p) * 1000) / 1000;
  },
  ratioToIss: function (o2, p, issPo2) {
    return Math.round((BPLogic.pO2(o2, p) / issPo2) * 1000) / 1000;
  },
  envelope: function (points, o2, p, rule) {
    var inside = [];
    for (var i = 0; i < points.length; i++) {
      var t = points[i];
      if (Math.abs(t[1] - o2) <= rule.o2 && Math.abs(t[2] - p) <= rule.p) inside.push(t);
    }
    var n = inside.length;
    return { status: n >= rule.min ? "supported" : n > 0 ? "sparse" : "no_data", count: n, inside: inside };
  },
};
