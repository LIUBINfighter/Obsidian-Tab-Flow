import javascript

/**
 * Flag uses of console.debug / console.info / console.log to avoid unnecessary logging in plugins.
 */
from CallExpr call, MemberAccess ma
where
  ma = call.getCallee().(MemberAccess) and
  ma.getMemberName() in ["log","info","debug"]
select call, "Avoid non-error console logging in plugin code: %s", ma.getMemberName()
