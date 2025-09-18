import javascript
import semmle.javascript.security.dataflow.CodeInjectionQuery

/**
 * Flags direct uses of innerHTML/outerHTML/insertAdjacentHTML on DOM elements
 * which can lead to XSS or unsafe HTML insertion.
 */
from PropertyAccess pa, MemberAccess ma
where
  pa.getTarget().getType().hasName("Element") and
  ma = pa and
  ma.getMemberName() in ["innerHTML", "outerHTML"]
select pa, "Potential unsafe HTML assignment: $@", pa.getMemberName()
