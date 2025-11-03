import { NextResponse } from 'next/server';

const SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;

export async function GET() {
  if (!SPEECH_REGION || !SPEECH_KEY) {
    return NextResponse.json(
      { error: 'Azure Speech configuration is missing' },
      { status: 500 }
    );
  }

  try {
    const tokenEndpoint = `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Azure Speech token request failed with status ${response.status}: ${errorText}`
      );
    }

    const token = await response.text();
    return NextResponse.json({
      token,
      region: SPEECH_REGION,
      expiresIn: 600,
    });
  } catch (error) {
    console.error('Failed to mint Azure Speech token:', error);
    return NextResponse.json(
      { error: 'Failed to mint Azure Speech token' },
      { status: 500 }
    );
  }
}
