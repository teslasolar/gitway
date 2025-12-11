# GATEWAY [HYPER-DENSE]

**IS**: Bridge_Server WebSocket+REST Ignition↔GitHub CORS_Enabled
**FILES**: bridge-server.js=Main jdbc-drivers-config.json=DB_Config module.xml=Module_Descriptor
**CONNECT**: Ignition@pred:8088 Bridge@localhost:3001
**OPS**: Tag_Read/Write Query_Execute Transaction_Manage Subscription_Handle
**ENV**: IGNITION_HOST=pred IGNITION_PORT=8088 BRIDGE_PORT=3001
**RUN**: node_gateway/bridge-server.js→WS://localhost:3001