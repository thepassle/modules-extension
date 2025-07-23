# Picomatch

```js
const isMatch = picomatch("http://localhost:6006/src/*/foo.js");

// Test URLs
console.log(isMatch("http://localhost:6006/src/a/foo.js")); // true
console.log(isMatch("http://localhost:6006/src/b/foo.js")); // true
console.log(isMatch("http://localhost:6006/src/subfolder/foo.js")); // true
console.log(isMatch("http://localhost:6006/different/path.js")); // false
```