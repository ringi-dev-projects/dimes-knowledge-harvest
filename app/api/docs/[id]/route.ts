import { NextRequest, NextResponse } from 'next/server';

// Mock document data for demo
const mockDocument = {
  companyName: 'Acme Manufacturing Co.',
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'products',
      title: 'Products & Services',
      content: `<p>Acme Manufacturing specializes in precision automotive components with three main product lines:</p>
        <ul>
          <li><strong>Engine Components:</strong> High-precision pistons, connecting rods, and crankshafts</li>
          <li><strong>Transmission Parts:</strong> Gears, shafts, and synchronizer assemblies</li>
          <li><strong>Custom Solutions:</strong> Bespoke components designed to customer specifications</li>
        </ul>
        <p>All products meet ISO 9001:2015 and IATF 16949 standards.</p>`,
      subsections: [
        {
          id: 'products-engine',
          title: 'Engine Components',
          content: `<h4>Manufacturing Process</h4>
            <p>Engine components follow a 12-step precision manufacturing process:</p>
            <ol>
              <li>Raw material inspection and verification</li>
              <li>CNC machining on 5-axis mills (tolerance: ±0.001mm)</li>
              <li>Heat treatment at 850°C for 4 hours</li>
              <li>Surface grinding and polishing</li>
              <li>Quality inspection using CMM (Coordinate Measuring Machine)</li>
            </ol>
            <h4>Critical Parameters</h4>
            <p><strong>Torque specifications:</strong> 45-50 Nm for main bearing bolts</p>
            <p><strong>Surface finish:</strong> Ra 0.8 or better</p>`,
        },
      ],
    },
    {
      id: 'processes',
      title: 'Manufacturing Processes',
      content: `<p>Our manufacturing facility operates on a lean production system with three main production lines:</p>
        <h3>Line 1: CNC Machining</h3>
        <p>12 CNC machines running 24/7 with automated tool changing. Cycle time: 8-15 minutes per part depending on complexity.</p>
        <h3>Line 2: Heat Treatment</h3>
        <p>Two industrial furnaces capable of processing 500kg batches. Critical monitoring of temperature and atmosphere composition.</p>
        <h3>Line 3: Assembly & Finishing</h3>
        <p>Manual assembly stations with semi-automated quality checks. Throughput: 200 units per shift.</p>`,
      subsections: [
        {
          id: 'processes-setup',
          title: 'Machine Setup Procedures',
          content: `<h4>Standard Setup Sequence</h4>
            <ol>
              <li>Verify work order and retrieve correct program (G-code)</li>
              <li>Install tooling according to tool list</li>
              <li>Set work offset using edge finder</li>
              <li>Run air cut to verify path</li>
              <li>Measure first article and adjust as needed</li>
            </ol>
            <p><strong>Important:</strong> Always verify tool length offsets after tool changes. Even 0.01mm error can cause rejection.</p>`,
        },
      ],
    },
    {
      id: 'equipment',
      title: 'Equipment & Machinery',
      content: `<h3>Primary Equipment Inventory</h3>
        <ul>
          <li><strong>DMG MORI NHX 5000:</strong> 5-axis horizontal machining center (×4 units)</li>
          <li><strong>Mazak Integrex i-400:</strong> Multi-tasking machine with live tooling (×2 units)</li>
          <li><strong>Inductotherm Furnaces:</strong> 850°C max, atmosphere-controlled (×2 units)</li>
          <li><strong>Zeiss CMM:</strong> Coordinate measuring machine for quality control</li>
        </ul>`,
      subsections: [
        {
          id: 'equipment-maintenance',
          title: 'Preventive Maintenance',
          content: `<h4>Daily Checks</h4>
            <ul>
              <li>Coolant level and concentration (8-10% for aluminum, 5-7% for steel)</li>
              <li>Hydraulic pressure (140-150 bar)</li>
              <li>Spindle temperature (should not exceed 45°C)</li>
            </ul>
            <h4>Weekly Maintenance</h4>
            <ul>
              <li>Clean chip conveyors and sump</li>
              <li>Inspect tool holders for wear</li>
              <li>Calibrate probe if used</li>
            </ul>
            <h4>Monthly Maintenance</h4>
            <ul>
              <li>Lubricate ball screws</li>
              <li>Check belt tension on servo motors</li>
              <li>Update machine hour meter logs</li>
            </ul>`,
        },
        {
          id: 'equipment-troubleshooting',
          title: 'Common Issues & Solutions',
          content: `<h4>Issue: Spindle Overheating</h4>
            <p><strong>Symptoms:</strong> Temperature above 50°C, grinding noise</p>
            <p><strong>Causes:</strong> Insufficient coolant flow, worn bearings, excessive cutting speed</p>
            <p><strong>Solution:</strong> Check coolant pump, reduce RPM by 10%, contact maintenance if noise persists</p>

            <h4>Issue: Dimensional Drift</h4>
            <p><strong>Symptoms:</strong> Parts measuring out of tolerance after 50+ cycles</p>
            <p><strong>Causes:</strong> Thermal expansion, tool wear, work offset shift</p>
            <p><strong>Solution:</strong> Allow warm-up period (15 min), check tool wear, re-set work offset</p>`,
        },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & Compliance',
      content: `<p>Safety is our top priority. All employees must complete annual safety training and follow these protocols:</p>
        <h3>Personal Protective Equipment (PPE)</h3>
        <ul>
          <li>Safety glasses (ANSI Z87.1 certified) - mandatory in all production areas</li>
          <li>Steel-toe boots - required on shop floor</li>
          <li>Hearing protection - required in areas above 85dB</li>
          <li>Cut-resistant gloves - when handling sharp materials</li>
        </ul>
        <h3>Machine Safety</h3>
        <ul>
          <li>Never reach into machine while spindle is rotating</li>
          <li>Use chip hooks, never hands, to remove chips</li>
          <li>Ensure all guards are in place before operation</li>
          <li>Emergency stop buttons located every 3 meters</li>
        </ul>
        <h3>Chemical Safety</h3>
        <p>All chemicals have SDS (Safety Data Sheets) available at chemical storage area. Key precautions:</p>
        <ul>
          <li><strong>Cutting fluids:</strong> Avoid skin contact, use barrier cream</li>
          <li><strong>Cleaning solvents:</strong> Use in ventilated areas only</li>
          <li><strong>Heat treatment salts:</strong> Handle with extreme caution, highly corrosive</li>
        </ul>`,
    },
    {
      id: 'quality',
      title: 'Quality Control',
      content: `<p>Our quality system ensures every part meets specifications through multi-stage inspection:</p>
        <h3>Incoming Inspection</h3>
        <p>All raw materials inspected for:</p>
        <ul>
          <li>Material certification (chemical composition)</li>
          <li>Dimensional accuracy</li>
          <li>Surface defects</li>
        </ul>
        <h3>In-Process Inspection</h3>
        <p>First article inspection (FAI) for every new setup, then periodic checks every 25 pieces.</p>
        <h3>Final Inspection</h3>
        <p>100% dimensional verification using CMM or optical comparator. Statistical process control (SPC) data recorded.</p>
        <h3>Acceptance Criteria</h3>
        <ul>
          <li>Critical dimensions: Within ±0.01mm</li>
          <li>General dimensions: Within ±0.05mm</li>
          <li>Surface finish: Ra ≤ 1.6</li>
          <li>No visible defects (cracks, porosity, contamination)</li>
        </ul>`,
    },
  ],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // In a real implementation, fetch from database based on company ID
    // For now, return mock data

    return NextResponse.json({
      success: true,
      document: mockDocument,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
