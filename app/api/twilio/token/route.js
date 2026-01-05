export const dynamic = 'force-dynamic'

export async function GET() {
  const hasConfig = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY_SID &&
    process.env.TWILIO_API_KEY_SECRET &&
    process.env.TWILIO_TWIML_APP_SID
  )
  
  return Response.json({ 
    status: hasConfig ? 'OK' : 'Missing config',
    configured: hasConfig,
    timestamp: new Date().toISOString()
  })
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const identity = body.identity || 'taskforce-agent'
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const apiKeySid = process.env.TWILIO_API_KEY_SID
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID
    
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      console.error('Missing env vars:', { accountSid: !!accountSid, apiKeySid: !!apiKeySid, apiKeySecret: !!apiKeySecret, twimlAppSid: !!twimlAppSid })
      return Response.json({ error: 'Twilio nicht vollständig konfiguriert' }, { status: 500 })
    }

    const twilio = (await import('twilio')).default
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    const sanitizedIdentity = identity.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: sanitizedIdentity,
      ttl: 3600
    })

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    })

    token.addGrant(voiceGrant)

    console.log('Token created for:', sanitizedIdentity)
    
    return Response.json({
      token: token.toJwt(),
      identity: sanitizedIdentity
    })
  } catch (error) {
    console.error('Token Error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
