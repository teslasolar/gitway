# Kaleidoscope Tag System

## Tag UDTs (User Defined Types)

### Structure
```
tags/
└── udts/
    ├── equipment/   # Physical equipment (motors, pumps, valves)
    ├── metrics/     # KPIs and measurements (OEE, production)
    └── process/     # Control structures (PID, batch, sequence)
```

## Equipment UDTs

### Motor
```json
[default]Equipment/Motor1/
├── Status (0=Stop, 1=Run, 2=Fault)
├── Cmd/Start, Stop, Reset
├── Speed/Actual, Setpoint (RPM)
├── Current (A)
└── Runtime (hours)
```

### Pump
```json
[default]Equipment/Pump1/
├── Flow/Rate (GPM), Total (gal)
├── Pressure/Inlet, Outlet (PSI)
└── VFD/Speed (%), Frequency (Hz)
```

### Valve
```json
[default]Equipment/Valve1/
├── Position/Actual, Setpoint (%)
├── Cmd/Open, Close
└── Interlocks/PermissiveOK
```

### Tank
```json
[default]Equipment/Tank1/
├── Level/Actual (%), Volume (L)
├── Temperature/Actual (C)
├── Agitator/Running, Speed (RPM)
└── Alarms/HighHigh, High, Low
```

## Metrics UDTs

### OEE
```json
[default]Metrics/OEE/
├── Availability (%)
├── Performance (%)
├── Quality (%)
└── Overall (%)
```

### Production
```json
[default]Metrics/Production/
├── Rate/Current (pcs/hr)
├── Count/Total, Good, Shift
└── Downtime/Total (min)
```

## Process UDTs

### PID Loop
```json
[default]Process/TempControl/
├── PV, SP, CV (%)
├── Tuning/Kp, Ki, Kd
└── Mode (0=Manual, 1=Auto)
```

## Usage

### Creating Tag Instance
```json
{
  "template": "motor",
  "instance": "Conveyor_Motor",
  "params": {
    "MotorID": "MTR-CV-001",
    "RatedHP": 25.0
  }
}
```

### Binding to Components
```json
{
  "type": "motor-control",
  "props": {
    "tagPath": "[default]Equipment/Conveyor_Motor"
  }
}
```

**All UDTs <250 tokens. Standard industrial types.**