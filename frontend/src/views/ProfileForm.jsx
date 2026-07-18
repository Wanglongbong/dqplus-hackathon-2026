import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { SECTORS, STAGES } from '../data/ecosystem.js';
import { riseIn } from '../lib/anim.js';
import './form.css';

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="req">*</span>}</label>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export default function ProfileForm({
  role, form, onField, onToggleSector, status, verification, savedAt, saving,
  saveError, showErrors, validity, missing, onSaveDraft, onReady,
}) {
  const rootRef = useRef(null);
  useGSAP(() => { if (rootRef.current) riseIn(rootRef.current); }, { scope: rootRef, dependencies: [] });

  const investor = role === 'investor';
  const allValid = missing.length === 0;
  const invalid = (key) => showErrors && !validity[key];
  const cls = (base, key) => `${base}${invalid(key) ? ' invalid' : ''}`;

  return (
    <main ref={rootRef} className="vn-form-container">
      <div className="eyebrow rise">Verified community profile</div>
      <h1 className="serif-h1 rise" style={{ marginTop: 12 }}>Make the right people understand your fit.</h1>
      <p className="lede rise">Your contact details stay private until both sides accept a connection.</p>

      <div className="vn-profile-state rise">
        <span className="chip on">{investor ? 'Investor' : 'Startup'}</span>
        <span className={`vn-verify-pill ${verification || 'unverified'}`}>
          {verification === 'verified' ? '✓ Community profile verified' : verification === 'pending' ? 'Manual verification pending' : 'Not verified yet'}
        </span>
      </div>

      <div className="vn-form-fields">
        <div className="vn-form-grid rise">
          <Field label={investor ? 'Fund name' : 'Startup name'} required error={invalid('name') ? 'Enter your organization name.' : ''}>
            <input className={cls('input', 'name')} value={form.name} onChange={(e) => onField('name', e.target.value)} />
          </Field>
          <Field label="Company website" required error={invalid('website') ? 'Enter a valid company website.' : ''}>
            <input className={cls('input', 'website')} value={form.website} onChange={(e) => onField('website', e.target.value)} placeholder="https://company.vn" />
          </Field>
        </div>

        <div className="vn-form-grid rise">
          <Field label="Stage" required error={invalid('stage') ? 'Select a stage.' : ''}>
            <select className={cls('select', 'stage')} value={form.stage} onChange={(e) => onField('stage', e.target.value)}>
              <option value="">Select…</option>
              {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select>
          </Field>
          <Field label="Geography" required error={invalid('geography') ? 'Enter at least one market.' : ''}>
            <input className={cls('input', 'geography')} value={form.geography} onChange={(e) => onField('geography', e.target.value)} placeholder="Vietnam, Southeast Asia" />
          </Field>
        </div>

        <div className="vn-form-grid rise">
          <Field label="Work email" required error={invalid('email') ? 'Use a valid work email.' : ''}>
            <input type="email" className={cls('input', 'email')} value={form.email} onChange={(e) => onField('email', e.target.value)} placeholder="you@company.vn" />
          </Field>
          <Field label="LinkedIn" error="">
            <input className="input" value={form.linkedin} onChange={(e) => onField('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" />
          </Field>
        </div>

        <div className="vn-form-grid rise">
          <Field label="Phone (revealed after acceptance)" error="">
            <input type="tel" className="input" value={form.phone} onChange={(e) => onField('phone', e.target.value)} placeholder="+84…" />
          </Field>
          <Field label="Profile visibility" required error="">
            <select className="select" value={form.visibility} onChange={(e) => onField('visibility', e.target.value)}>
              <option value="community">Visible to verified community</option>
              <option value="private">Private draft</option>
            </select>
          </Field>
        </div>

        <div className="rise">
          <label className="label">Sectors <span className="req">*</span></label>
          <div className="vn-form-sector-wrap">
            {SECTORS.map((sector) => (
              <button key={sector.id} type="button" className={`chip${form.sectors.includes(sector.id) ? ' on' : ''}`} onClick={() => onToggleSector(sector.id)}>
                {sector.label}
              </button>
            ))}
          </div>
          {invalid('sectors') && <div className="field-error">Select at least one sector.</div>}
        </div>

        <Field label={investor ? 'Investment thesis' : 'Product and business model'} required error={invalid('description') ? 'Add enough detail for a credible match.' : ''}>
          <textarea className={cls('textarea', 'description')} value={investor ? form.thesis : form.description} onChange={(e) => onField(investor ? 'thesis' : 'description', e.target.value)} placeholder={investor ? 'What do you invest in, and why?' : 'What do you build, for whom, and how do you make money?'} />
        </Field>

        {investor ? (
          <>
            <div className="vn-form-grid rise">
              <Field label="Minimum ticket (USD)" required error={invalid('checkSizeMin') ? 'Enter a minimum ticket.' : ''}>
                <input type="number" min="1" className={cls('input', 'checkSizeMin')} value={form.checkSizeMin} onChange={(e) => onField('checkSizeMin', e.target.value)} />
              </Field>
              <Field label="Maximum ticket (USD)" required error={invalid('checkSizeMax') ? 'Maximum must be at least the minimum.' : ''}>
                <input type="number" min="1" className={cls('input', 'checkSizeMax')} value={form.checkSizeMax} onChange={(e) => onField('checkSizeMax', e.target.value)} />
              </Field>
            </div>
            <Field label="Portfolio highlights" error="">
              <textarea className="textarea" value={form.portfolio} onChange={(e) => onField('portfolio', e.target.value)} placeholder="Relevant companies, exits or operating experience" />
            </Field>
          </>
        ) : (
          <>
            <div className="vn-form-grid rise">
              <Field label="Funding ask (USD)" required error={invalid('fundingAsk') ? 'Enter the amount you are raising.' : ''}>
                <input type="number" min="1" className={cls('input', 'fundingAsk')} value={form.fundingAsk} onChange={(e) => onField('fundingAsk', e.target.value)} />
              </Field>
              <Field label="Year founded" required error={invalid('yearFounded') ? 'Enter a four-digit year.' : ''}>
                <input type="number" min="1900" max="2100" className={cls('input', 'yearFounded')} value={form.yearFounded} onChange={(e) => onField('yearFounded', e.target.value)} />
              </Field>
            </div>
            <div className="vn-form-grid rise">
              <Field label="Team size" required error={invalid('companySize') ? 'Enter your team size.' : ''}>
                <input type="number" min="1" className={cls('input', 'companySize')} value={form.companySize} onChange={(e) => onField('companySize', e.target.value)} />
              </Field>
              <Field label="Traction" required error={invalid('traction') ? 'Add customers, revenue, pilots or another signal.' : ''}>
                <input className={cls('input', 'traction')} value={form.traction} onChange={(e) => onField('traction', e.target.value)} placeholder="12 pilots · $8k MRR" />
              </Field>
            </div>
          </>
        )}

        <label className={`vn-form-consent rise${invalid('consent') ? ' invalid' : ''}${form.consent ? ' checked' : ''}`}>
          <input type="checkbox" className="vn-form-consent-checkbox" checked={form.consent} onChange={(e) => onField('consent', e.target.checked)} />
          <span className="vn-form-consent-text">I agree to use this profile for matching and understand that contact details are revealed only after a connection is accepted. <span className="req">*</span></span>
        </label>

        {showErrors && !allValid && <div className="vn-form-summary rise"><b>Complete before Ready:</b> {missing.join(', ')}.</div>}
        {saveError && <div className="vn-form-summary rise">{saveError}</div>}

        <div className="vn-form-footer rise">
          <span className="vn-form-helper">{saving ? 'Saving…' : savedAt ? 'Saved to your account.' : status === 'ready' ? 'Ready for trusted discovery.' : 'Private draft.'}</span>
          <div className="vn-form-footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onSaveDraft} disabled={saving}>Save draft</button>
            <button type="button" className="btn btn-primary" onClick={onReady} disabled={saving}>{status === 'ready' ? 'Refresh matches →' : 'Mark Ready →'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
