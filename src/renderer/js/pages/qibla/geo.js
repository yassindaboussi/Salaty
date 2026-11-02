"use strict";

// The Qibla on the sphere. The Qibla is the first direction of the shortest way (the great
// circle) from here to the Kaaba, measured from true North, clockwise
// (https://en.wikipedia.org/wiki/Qibla#Astronomical_calculations). On the flat (Mercator) map
// that way is a curve, not the straight line between the two points.

/** The Kaaba, Makkah (WGS 84). */
const KAABA = { lat: 21.422487, lon: 39.826206 };

const EARTH_RADIUS_KM = 6371.0088; // mean radius (IUGG)
const RAD = Math.PI / 180;

/**
 * Distance (radians of arc) and first bearing (degrees from North, clockwise) from one point
 * to another along the great circle.
 * @param {number} lat0 @param {number} lon0 @param {number} lat @param {number} lon
 */
function arcAndBearing(lat0, lon0, lat, lon) {
  const p0 = lat0 * RAD;
  const p = lat * RAD;
  const dl = (lon - lon0) * RAD;
  const cosArc =
    Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
  const arc = Math.acos(Math.min(1, Math.max(-1, cosArc)));
  const bearing = Math.atan2(
    Math.cos(p) * Math.sin(dl),
    Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl),
  );
  return { arc, bearing: (bearing / RAD + 360) % 360 };
}

/** @param {number} lat @param {number} lon */
function qiblaOf(lat, lon) {
  const { arc, bearing } = arcAndBearing(lat, lon, KAABA.lat, KAABA.lon);
  return { bearing, arc, km: arc * EARTH_RADIUS_KM };
}

/** 0 = North, 1 = North-east ... 7 = North-west. @param {number} bearing */
const compassPoint = (bearing) => Math.round(bearing / 45) % 8;

/**
 * Points along the great circle from here to the Kaaba (spherical interpolation), for the map's
 * line. Longitudes are unwrapped (may pass ±180) so a way over the Pacific draws as one curve.
 * @param {number} lat @param {number} lon @param {number} [steps]
 * @returns {[number, number][]} [lat, lon] pairs
 */
function wayToKaaba(lat, lon, steps = 128) {
  const { arc } = arcAndBearing(lat, lon, KAABA.lat, KAABA.lon);
  if (arc < 1e-9) return [[lat, lon]];
  const toXyz = (/** @type {number} */ la, /** @type {number} */ lo) => [
    Math.cos(la * RAD) * Math.cos(lo * RAD),
    Math.cos(la * RAD) * Math.sin(lo * RAD),
    Math.sin(la * RAD),
  ];
  const a = toXyz(lat, lon);
  const b = toXyz(KAABA.lat, KAABA.lon);
  /** @type {[number, number][]} */
  const points = [];
  let prevLon = lon;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const wa = Math.sin((1 - f) * arc) / Math.sin(arc);
    const wb = Math.sin(f * arc) / Math.sin(arc);
    const [x, y, z] = [0, 1, 2].map((k) => wa * a[k] + wb * b[k]);
    let pLon = Math.atan2(y, x) / RAD;
    pLon += Math.round((prevLon - pLon) / 360) * 360; // stay next to the previous point
    prevLon = pLon;
    points.push([Math.atan2(z, Math.hypot(x, y)) / RAD, pLon]);
  }
  return points;
}

module.exports = { KAABA, arcAndBearing, qiblaOf, compassPoint, wayToKaaba };
