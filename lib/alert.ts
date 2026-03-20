import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ALERT_EMAIL = 'zongshuya0109@gmail.com'

export async function sendAlert(subject: string, body: string) {
  try {
    await resend.emails.send({
      from: 'AIJobRadar Alerts <noreply@aistartupjob.com>',
      to: ALERT_EMAIL,
      subject: `[AIJobRadar Alert] ${subject}`,
      text: body,
    })
    console.log('Alert sent:', subject)
  } catch (err) {
    console.error('Failed to send alert email:', err)
  }
}
