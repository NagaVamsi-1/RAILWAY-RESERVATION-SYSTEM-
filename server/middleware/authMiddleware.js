
function requireAuth(req, res, next) {
    // Temporary placeholder until the project's real
    // authentication system is integrated.
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }
  
    next();
  }
  
  module.exports = requireAuth;
  