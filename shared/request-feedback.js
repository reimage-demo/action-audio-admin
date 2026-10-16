const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function beginSubmission(form,button,status,label='Sending your request…') {
 const controls=[...form.querySelectorAll('input,select,textarea')].map(control=>[control,control.disabled]);
 const original=button.textContent;
 form.dataset.submitting='true';form.setAttribute('aria-busy','true');
 controls.forEach(([control])=>control.disabled=true);
 button.disabled=true;button.classList.add('is-loading');button.textContent=label;
 status.setAttribute('role','status');
 status.innerHTML='<div class="form-feedback"><span class="request-spinner" aria-hidden="true"></span><span>Sending securely. Please keep this page open.</span></div>';
 const slow=setTimeout(()=>{status.innerHTML='<div class="form-feedback"><span class="request-spinner" aria-hidden="true"></span><span>This is taking longer than usual. We’re still waiting for confirmation. Keep this page open; you won’t need to enter your details again.</span></div>';},10000);
 return ()=>{
  clearTimeout(slow);delete form.dataset.submitting;form.removeAttribute('aria-busy');
  controls.forEach(([control,disabled])=>control.disabled=disabled);
  button.disabled=false;button.classList.remove('is-loading');button.textContent=original;
 };
}
export function submissionError(status,error) {
 const detail=typeof error?.data==='string'?error.data:!navigator.onLine?'You appear to be offline. Reconnect and try again.':'We couldn’t confirm your request. Please try again.';
 status.setAttribute('role','alert');
 status.innerHTML=`<div class="form-feedback form-feedback-error"><strong>${escape(detail)}</strong><span>Your details are still here. You can retry, or <a href="tel:8606676330">call (860) 667-6330</a> for help.</span></div>`;
 status.focus();
}
