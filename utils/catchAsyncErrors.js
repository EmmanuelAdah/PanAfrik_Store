module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // Automatically passes errors to the global handler
  };
};