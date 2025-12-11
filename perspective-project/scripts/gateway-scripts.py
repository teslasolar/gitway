"""
GitWay Gateway Scripts
Python scripts for Ignition Gateway that provide API endpoints and functionality
"""

import json
import system
from java.util import Date

class GitWayGateway:
    """Main gateway handler for GitWay operations"""

    @staticmethod
    def discoverComponents():
        """Discover available gateway components"""
        components = {
            "modules": [],
            "tagProviders": [],
            "databases": [],
            "projects": [],
            "devices": [],
            "alarmJournals": []
        }

        # Discover modules
        modules = system.util.getModules()
        for module in modules:
            components["modules"].append({
                "name": module.getName(),
                "version": module.getVersion(),
                "status": module.getState()
            })

        # Discover tag providers
        providers = system.tag.browse("").results
        for provider in providers:
            components["tagProviders"].append({
                "name": str(provider['name']),
                "type": "standard"
            })

        # Discover database connections
        try:
            databases = system.db.getConnectionNames()
            for db in databases:
                components["databases"].append({
                    "name": db,
                    "type": "configured"
                })
        except:
            pass

        # Discover projects
        try:
            projects = system.util.getProjectNames()
            for project in projects:
                components["projects"].append({
                    "name": project,
                    "enabled": True
                })
        except:
            pass

        # Discover devices
        try:
            devices = system.device.listDevices()
            for device in devices:
                components["devices"].append({
                    "name": device.getName(),
                    "enabled": device.isEnabled()
                })
        except:
            pass

        return components

    @staticmethod
    def readTags(tagPaths):
        """Read multiple tag values"""
        if not isinstance(tagPaths, list):
            tagPaths = [tagPaths]

        results = []
        values = system.tag.readBlocking(tagPaths)

        for i, value in enumerate(values):
            results.append({
                "tagPath": tagPaths[i],
                "value": value.value,
                "quality": str(value.quality),
                "timestamp": str(value.timestamp)
            })

        return results

    @staticmethod
    def writeTags(tagWrites):
        """Write multiple tag values"""
        if not isinstance(tagWrites, list):
            tagWrites = [tagWrites]

        paths = []
        values = []

        for write in tagWrites:
            paths.append(write["tagPath"])
            values.append(write["value"])

        results = system.tag.writeBlocking(paths, values)

        return [{
            "tagPath": paths[i],
            "success": results[i].isGood(),
            "quality": str(results[i])
        } for i in range(len(results))]

    @staticmethod
    def browseTags(path="", recursive=False):
        """Browse tag structure"""
        results = []

        if path:
            browse = system.tag.browse(path, {"recursive": recursive})
        else:
            browse = system.tag.browse("")

        for result in browse.results:
            results.append({
                "name": str(result['name']),
                "path": str(result['fullPath']),
                "type": str(result['tagType']) if 'tagType' in result else 'folder',
                "hasChildren": result['hasChildren'] if 'hasChildren' in result else False
            })

        return results

    @staticmethod
    def queryTagHistory(tagPaths, startDate, endDate, options={}):
        """Query tag history"""
        if not isinstance(tagPaths, list):
            tagPaths = [tagPaths]

        # Parse dates
        start = system.date.parse(startDate)
        end = system.date.parse(endDate)

        # Query history
        dataset = system.tag.queryTagHistory(
            paths=tagPaths,
            startDate=start,
            endDate=end,
            returnSize=options.get("returnSize", 1000),
            aggregationMode=options.get("aggregationMode", "Average"),
            returnFormat=options.get("returnFormat", "Wide")
        )

        # Convert dataset to list of dictionaries
        results = []
        for row in range(dataset.getRowCount()):
            rowData = {}
            for col in range(dataset.getColumnCount()):
                colName = dataset.getColumnName(col)
                rowData[colName] = dataset.getValueAt(row, col)
            results.append(rowData)

        return results

    @staticmethod
    def queryAlarms(filters={}):
        """Query active and historical alarms"""
        state = filters.get("state", ["ActiveUnacked", "ActiveAcked"])
        priority = filters.get("priority", [1, 2, 3, 4])

        results = system.alarm.queryStatus(
            state=state,
            priority=priority
        )

        alarms = []
        for alarm in results:
            alarms.append({
                "id": str(alarm.getId()),
                "displayPath": str(alarm.getDisplayPath()),
                "priority": alarm.getPriority().intValue(),
                "state": str(alarm.getState()),
                "activeTime": str(alarm.getActiveTime()),
                "notes": str(alarm.getNotes())
            })

        return alarms

    @staticmethod
    def executeNamedQuery(path, parameters={}):
        """Execute a named query"""
        try:
            result = system.db.runNamedQuery(path, parameters)
            return system.dataset.toPyDataSet(result)
        except Exception as e:
            return {"error": str(e)}

# WebDev endpoint handlers
def handleWebDevRequest(request):
    """Main WebDev request handler"""
    path = request['remainingPath']
    method = request['method']

    if path == '/discover':
        return GitWayGateway.discoverComponents()

    elif path == '/tags/read':
        data = request['data']
        return GitWayGateway.readTags(data.get('tagPaths', []))

    elif path == '/tags/write':
        data = request['data']
        return GitWayGateway.writeTags(data.get('tagWrites', []))

    elif path == '/tags/browse':
        data = request['data']
        return GitWayGateway.browseTags(
            data.get('path', ''),
            data.get('recursive', False)
        )

    elif path == '/tags/history':
        data = request['data']
        return GitWayGateway.queryTagHistory(
            data.get('tagPaths'),
            data.get('startDate'),
            data.get('endDate'),
            data.get('options', {})
        )

    elif path == '/alarms/query':
        data = request['data']
        return GitWayGateway.queryAlarms(data.get('filters', {}))

    elif path == '/named-query/execute':
        data = request['data']
        return GitWayGateway.executeNamedQuery(
            data.get('path'),
            data.get('parameters', {})
        )

    else:
        return {"error": "Unknown endpoint"}

# Perspective session scripts
def onStartup(session):
    """Initialize GitWay session"""
    session.custom.gitway = {
        "initialized": True,
        "bridgeConnected": False,
        "discoveredComponents": GitWayGateway.discoverComponents(),
        "subscriptions": []
    }

def refreshComponents(session):
    """Refresh discovered components"""
    session.custom.gitway.discoveredComponents = GitWayGateway.discoverComponents()
    return session.custom.gitway.discoveredComponents

def subscribeToTag(session, tagPath, interval=1000):
    """Subscribe to tag updates"""
    subscriptionId = system.util.guid()

    def updateTag():
        values = GitWayGateway.readTags([tagPath])
        if values:
            system.perspective.sendMessage(
                "GitWay.TagUpdate",
                payload={
                    "subscriptionId": subscriptionId,
                    "tagPath": tagPath,
                    "data": values[0]
                },
                scope="session",
                sessionId=session.id
            )

    # Create timer
    system.util.invokeAsynchronous(
        lambda: system.util.invokeLater(updateTag, interval, True)
    )

    # Store subscription
    session.custom.gitway.subscriptions.append({
        "id": subscriptionId,
        "tagPath": tagPath,
        "interval": interval
    })

    return subscriptionId