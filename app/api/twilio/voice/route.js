export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ 
    status: 'OK',
    endpoint: 'Twilio Voice Webhook',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let to = null
    let from = null
    
    if (contentType.includes('form')) {
      const formData = await request.formData()
      to = formData.get('To')
      from = formData.get('From')
      console.log('Voice webhook:', { to, from })
    }

    const callerId = process.env.TWILIO_PHONE_NUMBER || '+4997180263000'
    const elevenLabsAgentId = process.env.ELEVENLABS_AGENT_ID || 'agent_9601ke6t1nmee7ht7q0ctcqqazqm'

    // OUTBOUND: CRM ruft einen Lead an
    if (to && to.startsWith('+')) {
      console.log('Outbound call to:', to)
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" answerOnBridge="true" timeout="30">
    <Number>${to}</Number>
  </Dial>
</Response>`
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }
    
    // INBOUND: Anrufer wird mit ElevenLabs Voice Agent verbunden
    console.log('Inbound call from:', from, '-> Connecting to ElevenLabs Agent')
    const inboundTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${elevenLabsAgentId}">
      <Parameter name="caller_number" value="${from || 'unknown'}" />
    </Stream>
  </Connect>
</Response>`

    return new Response(inboundTwiml, { headers: { 'Content-Type': 'text/xml' } })

  } catch (error) {
    console.error('Voice Error:', error)
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.</Say>
</Response>`
    return new Response(errorTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
