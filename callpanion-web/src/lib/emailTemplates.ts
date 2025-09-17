// emailTemplates.ts

type InviteVars = {
  token: string;
  householdId?: string;
  inviteeEmail: string;
  inviterName?: string;     // optional: display name of the inviter
};

export function inviteSubject(vars: InviteVars) {
  const name = vars.inviterName?.trim() || 'A family member';
  return `${name} invited you to join CallPanion`;
}

export function invitePreheader(vars: InviteVars) {
  return `Accept the invite to view and support your loved one on CallPanion.`;
}

export function inviteJoinUrl(vars: InviteVars) {
  // Use production domain when available, fallback to lovable.app for development
  const base = window.location.hostname === 'callpanion.co.uk' 
    ? 'https://callpanion.co.uk/accept-invite'
    : 'https://callpanion.lovable.app/accept-invite';
  const q = new URLSearchParams({ token: vars.token });
  if (vars.householdId) q.set('household_id', vars.householdId);
  return `${base}?${q.toString()}`;
}

export function inviteHtml(vars: InviteVars) {
  const joinUrl = inviteJoinUrl(vars);
  const preheader = invitePreheader(vars);
  const inviter = vars.inviterName?.trim() || 'A family member';

  // Mobile‑first, inline CSS; accessible; dark‑mode friendly
  return `
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${inviteSubject(vars)}</title>
  <style>
    /* Basic reset for email clients */
    body,table,td,a{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
    img{border:0;outline:none;text-decoration:none;max-width:100%;}
    table{border-collapse:collapse;}
    .btn a{display:inline-block;padding:14px 22px;text-decoration:none;border-radius:6px;}
    .muted{color:#6b7280;font-size:12px;line-height:1.5;}
    .container{width:100%;background:#F7F7F5;padding:24px 0;}
    .card{max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;}
    .header{padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#0F3B2E;color:#ffffff;}
    .h1{margin:0;font-size:20px;line-height:1.3;font-weight:700;}
    .content{padding:24px;}
    .cta{margin:24px 0;}
    .btn a{background:#C75B3B;color:#ffffff;font-weight:700;}
    .secondary a{color:#C75B3B;word-break:break-all;}
    .footer{padding:16px 24px;text-align:center;}
    @media (prefers-color-scheme: dark){
      .container{background:#0b0f0d;}
      .card{background:#111827;border-color:#1f2937;}
      .header{background:#0F3B2E;color:#fff;}
      .btn a{background:#C75B3B;color:#fff;}
      .muted{color:#9CA3AF;}
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  <div class="container">
    <table role="presentation" class="card" aria-label="CallPanion invitation email">
      <tr>
        <td class="header">
          <div class="h1">CallPanion</div>
          <div style="font-size:0;height:0;opacity:0;overflow:hidden;display:none;">${preheader}</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p style="margin:0 0 12px 0;">Hello,</p>
          <p style="margin:0 0 12px 0;">${inviter} has invited you to join their <strong>CallPanion</strong> household so you can privately view wellbeing updates and support a loved one.</p>
          <div class="cta btn"><a href="${joinUrl}" target="_blank" rel="noopener">Accept invite</a></div>
          <p class="secondary" style="margin:0 0 8px 0;">Or paste this link into your browser:<br><a href="${joinUrl}" target="_blank" rel="noopener">${joinUrl}</a></p>
          <p style="margin:16px 0 0 0;">If you weren't expecting this, you can safely ignore the email and no changes will be made.</p>
        </td>
      </tr>
      <tr><td class="footer">
        <p class="muted">
          You're receiving this because ${vars.inviteeEmail} was entered as a contact for a CallPanion household invite.<br>
          We process emails for service delivery under UK GDPR &amp; PECR. Questions? Contact support@callpanion.co.uk.
        </p>
        <p class="muted">© ${new Date().getFullYear()} CallPanion. All rights reserved.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

export function inviteText(vars: InviteVars) {
  const inviter = vars.inviterName?.trim() || 'A family member';
  const joinUrl = inviteJoinUrl(vars);
  return [
    `${inviter} has invited you to join their CallPanion household.`,
    ``,
    `Accept your invite: ${joinUrl}`,
    ``,
    `If you weren't expecting this, you can ignore the email.`,
    ``,
    `You received this because ${vars.inviteeEmail} was entered for a CallPanion invite.`
  ].join('\n');
}