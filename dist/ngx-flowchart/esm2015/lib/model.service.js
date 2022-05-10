import { FlowchartConstants } from './ngx-flowchart.models';
import { of, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
export class FcModelService {
    constructor(modelValidation, model, modelChanged, detectChangesSubject, selectedObjects, dropNode, createEdge, edgeAddedCallback, nodeRemovedCallback, edgeRemovedCallback, canvasHtmlElement, svgHtmlElement, verticaledgeenabled) {
        this.connectorsRectInfos = {};
        this.nodesHtmlElements = {};
        this.canvasHtmlElement = null;
        this.dragImage = null;
        this.svgHtmlElement = null;
        this.debouncer = new Subject();
        this.modelValidation = modelValidation;
        this.model = model;
        this.modelChanged = modelChanged;
        this.detectChangesSubject = detectChangesSubject;
        this.canvasHtmlElement = canvasHtmlElement;
        this.svgHtmlElement = svgHtmlElement;
        this.modelValidation.validateModel(this.model);
        this.selectedObjects = selectedObjects;
        this.verticaledgeenabled = verticaledgeenabled;
        this.dropNode = dropNode || (() => { });
        this.createEdge = createEdge || ((event, edge) => of(Object.assign(Object.assign({}, edge), { label: 'label' })));
        this.edgeAddedCallback = edgeAddedCallback || (() => { });
        this.nodeRemovedCallback = nodeRemovedCallback || (() => { });
        this.edgeRemovedCallback = edgeRemovedCallback || (() => { });
        this.connectors = new ConnectorsModel(this);
        this.nodes = new NodesModel(this);
        this.edges = new EdgesModel(this);
        this.debouncer
            .pipe(debounceTime(100))
            .subscribe(() => this.modelChanged.emit());
    }
    notifyModelChanged() {
        this.debouncer.next();
    }
    detectChanges() {
        setTimeout(() => {
            this.detectChangesSubject.next();
        }, 0);
    }
    selectObject(object) {
        if (this.isEditable()) {
            if (this.selectedObjects.indexOf(object) === -1) {
                this.selectedObjects.push(object);
            }
        }
    }
    deselectObject(object) {
        if (this.isEditable()) {
            const index = this.selectedObjects.indexOf(object);
            if (index === -1) {
                throw new Error('Tried to deselect an unselected object');
            }
            this.selectedObjects.splice(index, 1);
        }
    }
    toggleSelectedObject(object) {
        if (this.isSelectedObject(object)) {
            this.deselectObject(object);
        }
        else {
            this.selectObject(object);
        }
    }
    isSelectedObject(object) {
        return this.selectedObjects.indexOf(object) !== -1;
    }
    selectAll() {
        this.model.nodes.forEach(node => {
            if (!node.readonly) {
                this.nodes.select(node);
            }
        });
        this.model.edges.forEach(edge => {
            this.edges.select(edge);
        });
        this.detectChanges();
    }
    deselectAll() {
        this.selectedObjects.splice(0, this.selectedObjects.length);
        this.detectChanges();
    }
    isEditObject(object) {
        return this.selectedObjects.length === 1 &&
            this.selectedObjects.indexOf(object) !== -1;
    }
    inRectBox(x, y, rectBox) {
        return x >= rectBox.left && x <= rectBox.right &&
            y >= rectBox.top && y <= rectBox.bottom;
    }
    getItemInfoAtPoint(x, y) {
        return {
            node: this.getNodeAtPoint(x, y),
            edge: this.getEdgeAtPoint(x, y)
        };
    }
    getNodeAtPoint(x, y) {
        for (const node of this.model.nodes) {
            const element = this.nodes.getHtmlElement(node.id);
            const nodeElementBox = element.getBoundingClientRect();
            if (x >= nodeElementBox.left && x <= nodeElementBox.right
                && y >= nodeElementBox.top && y <= nodeElementBox.bottom) {
                return node;
            }
        }
        return null;
    }
    getEdgeAtPoint(x, y) {
        const element = document.elementFromPoint(x, y);
        const id = element.id;
        let edgeIndex = -1;
        if (id) {
            if (id.startsWith('fc-edge-path-')) {
                edgeIndex = Number(id.substring('fc-edge-path-'.length));
            }
            else if (id.startsWith('fc-edge-label-')) {
                edgeIndex = Number(id.substring('fc-edge-label-'.length));
            }
        }
        if (edgeIndex > -1) {
            return this.model.edges[edgeIndex];
        }
        return null;
    }
    selectAllInRect(rectBox) {
        this.model.nodes.forEach((value) => {
            const element = this.nodes.getHtmlElement(value.id);
            const nodeElementBox = element.getBoundingClientRect();
            if (!value.readonly) {
                const x = nodeElementBox.left + nodeElementBox.width / 2;
                const y = nodeElementBox.top + nodeElementBox.height / 2;
                if (this.inRectBox(x, y, rectBox)) {
                    this.nodes.select(value);
                }
                else {
                    if (this.nodes.isSelected(value)) {
                        this.nodes.deselect(value);
                    }
                }
            }
        });
        const canvasElementBox = this.canvasHtmlElement.getBoundingClientRect();
        this.model.edges.forEach((value) => {
            const start = this.edges.sourceCoord(value);
            const end = this.edges.destCoord(value);
            const x = (start.x + end.x) / 2 + canvasElementBox.left;
            const y = (start.y + end.y) / 2 + canvasElementBox.top;
            if (this.inRectBox(x, y, rectBox)) {
                this.edges.select(value);
            }
            else {
                if (this.edges.isSelected(value)) {
                    this.edges.deselect(value);
                }
            }
        });
    }
    deleteSelected() {
        const edgesToDelete = this.edges.getSelectedEdges();
        edgesToDelete.forEach((edge) => {
            this.edges.delete(edge);
        });
        const nodesToDelete = this.nodes.getSelectedNodes();
        nodesToDelete.forEach((node) => {
            this.nodes.delete(node);
        });
    }
    isEditable() {
        return this.dropTargetId === undefined;
    }
    isDropSource() {
        return this.dropTargetId !== undefined;
    }
    getDragImage() {
        if (!this.dragImage) {
            this.dragImage = new Image();
            this.dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            this.dragImage.style.visibility = 'hidden';
        }
        return this.dragImage;
    }
}
class AbstractFcModel {
    constructor(modelService) {
        this.modelService = modelService;
    }
    select(object) {
        this.modelService.selectObject(object);
    }
    deselect(object) {
        this.modelService.deselectObject(object);
    }
    toggleSelected(object) {
        this.modelService.toggleSelectedObject(object);
    }
    isSelected(object) {
        return this.modelService.isSelectedObject(object);
    }
    isEdit(object) {
        return this.modelService.isEditObject(object);
    }
}
class ConnectorsModel extends AbstractFcModel {
    constructor(modelService) {
        super(modelService);
    }
    getConnector(connectorId) {
        const model = this.modelService.model;
        for (const node of model.nodes) {
            for (const connector of node.connectors) {
                if (connector.id === connectorId) {
                    return connector;
                }
            }
        }
    }
    getConnectorRectInfo(connectorId) {
        return this.modelService.connectorsRectInfos[connectorId];
    }
    setConnectorRectInfo(connectorId, connectorRectInfo) {
        this.modelService.connectorsRectInfos[connectorId] = connectorRectInfo;
        this.modelService.detectChanges();
    }
    _getCoords(connectorId, centered) {
        const connectorRectInfo = this.getConnectorRectInfo(connectorId);
        const canvas = this.modelService.canvasHtmlElement;
        if (connectorRectInfo === null || connectorRectInfo === undefined || canvas === null) {
            return { x: 0, y: 0 };
        }
        if (this.modelService.verticaledgeenabled) {
            let x = connectorRectInfo.nodeRectInfo.left() + (connectorRectInfo.nodeRectInfo.width() / 2);
            let y = connectorRectInfo.type === FlowchartConstants.leftConnectorType ?
                connectorRectInfo.nodeRectInfo.top() : connectorRectInfo.nodeRectInfo.bottom();
            if (!centered) {
                x -= connectorRectInfo.width / 2;
                y -= connectorRectInfo.height / 2;
            }
            const coords = {
                x: Math.round(x),
                y: Math.round(y)
            };
            return coords;
        }
        else {
            let x = connectorRectInfo.type === FlowchartConstants.leftConnectorType ?
                connectorRectInfo.nodeRectInfo.left() : connectorRectInfo.nodeRectInfo.right();
            let y = connectorRectInfo.nodeRectInfo.top() + connectorRectInfo.nodeRectInfo.height() / 2;
            if (!centered) {
                x -= connectorRectInfo.width / 2;
                y -= connectorRectInfo.height / 2;
            }
            const coords = {
                x: Math.round(x),
                y: Math.round(y)
            };
            return coords;
        }
    }
    getCoords(connectorId) {
        return this._getCoords(connectorId, false);
    }
    getCenteredCoord(connectorId) {
        return this._getCoords(connectorId, true);
    }
}
class NodesModel extends AbstractFcModel {
    constructor(modelService) {
        super(modelService);
    }
    getConnectorsByType(node, type) {
        return node.connectors.filter((connector) => {
            return connector.type === type;
        });
    }
    _addConnector(node, connector) {
        node.connectors.push(connector);
        try {
            this.modelService.modelValidation.validateNode(node);
        }
        catch (error) {
            node.connectors.splice(node.connectors.indexOf(connector), 1);
            throw error;
        }
    }
    delete(node) {
        if (this.isSelected(node)) {
            this.deselect(node);
        }
        const model = this.modelService.model;
        const index = model.nodes.indexOf(node);
        if (index === -1) {
            if (node === undefined) {
                throw new Error('Passed undefined');
            }
            throw new Error('Tried to delete not existing node');
        }
        const connectorIds = this.getConnectorIds(node);
        for (let i = 0; i < model.edges.length; i++) {
            const edge = model.edges[i];
            if (connectorIds.indexOf(edge.source) !== -1 || connectorIds.indexOf(edge.destination) !== -1) {
                this.modelService.edges.delete(edge);
                i--;
            }
        }
        model.nodes.splice(index, 1);
        this.modelService.notifyModelChanged();
        this.modelService.nodeRemovedCallback(node);
    }
    getSelectedNodes() {
        const model = this.modelService.model;
        return model.nodes.filter((node) => {
            return this.modelService.nodes.isSelected(node);
        });
    }
    handleClicked(node, ctrlKey) {
        if (ctrlKey) {
            this.modelService.nodes.toggleSelected(node);
        }
        else {
            this.modelService.deselectAll();
            this.modelService.nodes.select(node);
        }
    }
    _addNode(node) {
        const model = this.modelService.model;
        try {
            model.nodes.push(node);
            this.modelService.modelValidation.validateNodes(model.nodes);
        }
        catch (error) {
            model.nodes.splice(model.nodes.indexOf(node), 1);
            throw error;
        }
    }
    getConnectorIds(node) {
        return node.connectors.map((connector) => {
            return connector.id;
        });
    }
    getNodeByConnectorId(connectorId) {
        const model = this.modelService.model;
        for (const node of model.nodes) {
            const connectorIds = this.getConnectorIds(node);
            if (connectorIds.indexOf(connectorId) > -1) {
                return node;
            }
        }
        return null;
    }
    getHtmlElement(nodeId) {
        return this.modelService.nodesHtmlElements[nodeId];
    }
    setHtmlElement(nodeId, element) {
        this.modelService.nodesHtmlElements[nodeId] = element;
        this.modelService.detectChanges();
    }
}
class EdgesModel extends AbstractFcModel {
    constructor(modelService) {
        super(modelService);
    }
    sourceCoord(edge) {
        return this.modelService.connectors.getCenteredCoord(edge.source);
    }
    destCoord(edge) {
        return this.modelService.connectors.getCenteredCoord(edge.destination);
    }
    delete(edge) {
        const model = this.modelService.model;
        const index = model.edges.indexOf(edge);
        if (index === -1) {
            throw new Error('Tried to delete not existing edge');
        }
        if (this.isSelected(edge)) {
            this.deselect(edge);
        }
        model.edges.splice(index, 1);
        this.modelService.notifyModelChanged();
        this.modelService.edgeRemovedCallback(edge);
    }
    getSelectedEdges() {
        const model = this.modelService.model;
        return model.edges.filter((edge) => {
            return this.modelService.edges.isSelected(edge);
        });
    }
    handleEdgeMouseClick(edge, ctrlKey) {
        if (ctrlKey) {
            this.modelService.edges.toggleSelected(edge);
        }
        else {
            this.modelService.deselectAll();
            this.modelService.edges.select(edge);
        }
    }
    putEdge(edge) {
        const model = this.modelService.model;
        model.edges.push(edge);
        this.modelService.notifyModelChanged();
    }
    _addEdge(event, sourceConnector, destConnector, label) {
        this.modelService.modelValidation.validateConnector(sourceConnector);
        this.modelService.modelValidation.validateConnector(destConnector);
        const edge = {};
        edge.source = sourceConnector.id;
        edge.destination = destConnector.id;
        edge.label = label;
        const model = this.modelService.model;
        this.modelService.modelValidation.validateEdges(model.edges.concat([edge]), model.nodes);
        this.modelService.createEdge(event, edge).subscribe((created) => {
            model.edges.push(created);
            this.modelService.notifyModelChanged();
            this.modelService.edgeAddedCallback(created);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWwuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1mbG93Y2hhcnQvc3JjL2xpYi9tb2RlbC5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFTTCxrQkFBa0IsRUFDbkIsTUFBTSx3QkFBd0IsQ0FBQztBQUNoQyxPQUFPLEVBQWMsRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUUvQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFOUMsTUFBTSxPQUFPLGNBQWM7SUE2QnpCLFlBQVksZUFBeUMsRUFDekMsS0FBYyxFQUNkLFlBQStCLEVBQy9CLG9CQUFrQyxFQUNsQyxlQUFzQixFQUN0QixRQUE4QyxFQUM5QyxVQUE4RCxFQUM5RCxpQkFBeUMsRUFDekMsbUJBQTJDLEVBQzNDLG1CQUEyQyxFQUMzQyxpQkFBOEIsRUFDOUIsY0FBMEIsRUFDMUIsbUJBQTRCO1FBbEN4Qyx3QkFBbUIsR0FBeUIsRUFBRSxDQUFDO1FBQy9DLHNCQUFpQixHQUFtQixFQUFFLENBQUM7UUFDdkMsc0JBQWlCLEdBQWdCLElBQUksQ0FBQztRQUN0QyxjQUFTLEdBQXFCLElBQUksQ0FBQztRQUNuQyxtQkFBYyxHQUFlLElBQUksQ0FBQztRQVlqQixjQUFTLEdBQUcsSUFBSSxPQUFPLEVBQU8sQ0FBQztRQW9COUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLG9CQUFvQixDQUFDO1FBQ2pELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQztRQUMzQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsZUFB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QUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztRQUN0QyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6RixJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUNqRCxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ1YsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0MsQ0FBQyxDQUNGLENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBGY01vZGVsVmFsaWRhdGlvblNlcnZpY2UgfSBmcm9tICcuL21vZGVsdmFsaWRhdGlvbi5zZXJ2aWNlJztcbmltcG9ydCB7XG4gIEZjQ29ubmVjdG9yLFxuICBGY0Nvbm5lY3RvclJlY3RJbmZvLFxuICBGY0Nvb3JkcyxcbiAgRmNFZGdlLFxuICBGY0l0ZW1JbmZvLFxuICBGY01vZGVsLFxuICBGY05vZGUsXG4gIEZjUmVjdEJveCxcbiAgRmxvd2NoYXJ0Q29uc3RhbnRzXG59IGZyb20gJy4vbmd4LWZsb3djaGFydC5tb2RlbHMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgb2YsIFN1YmplY3QgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgZGVib3VuY2VUaW1lIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5leHBvcnQgY2xhc3MgRmNNb2RlbFNlcnZpY2Uge1xuXG4gIG1vZGVsVmFsaWRhdGlvbjogRmNNb2RlbFZhbGlkYXRpb25TZXJ2aWNlO1xuICBtb2RlbDogRmNNb2RlbDtcbiAgcHJpdmF0ZSByZWFkb25seSBkZXRlY3RDaGFuZ2VzU3ViamVjdDogU3ViamVjdDxhbnk+O1xuICBzZWxlY3RlZE9iamVjdHM6IGFueVtdO1xuXG4gIGNvbm5lY3RvcnNSZWN0SW5mb3M6IENvbm5lY3RvclJlY3RJbmZvTWFwID0ge307XG4gIG5vZGVzSHRtbEVsZW1lbnRzOiBIdG1sRWxlbWVudE1hcCA9IHt9O1xuICBjYW52YXNIdG1sRWxlbWVudDogSFRNTEVsZW1lbnQgPSBudWxsO1xuICBkcmFnSW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnQgPSBudWxsO1xuICBzdmdIdG1sRWxlbWVudDogU1ZHRWxlbWVudCA9IG51bGw7XG5cbiAgZHJvcE5vZGU6IChldmVudDogRXZlbnQsIG5vZGU6IEZjTm9kZSkgPT4gdm9pZDtcbiAgY3JlYXRlRWRnZTogKGV2ZW50OiBFdmVudCwgZWRnZTogRmNFZGdlKSA9PiBPYnNlcnZhYmxlPEZjRWRnZT47XG4gIGVkZ2VBZGRlZENhbGxiYWNrOiAoZWRnZTogRmNFZGdlKSA9PiB2b2lkO1xuICBub2RlUmVtb3ZlZENhbGxiYWNrOiAobm9kZTogRmNOb2RlKSA9PiB2b2lkO1xuICBlZGdlUmVtb3ZlZENhbGxiYWNrOiAoZWRnZTogRmNFZGdlKSA9PiB2b2lkO1xuICB2ZXJ0aWNhbGVkZ2VlbmFibGVkOiBib29sZWFuO1xuXG4gIGRyb3BUYXJnZXRJZDogc3RyaW5nO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxDaGFuZ2VkOiBFdmVudEVtaXR0ZXI8YW55PjtcbiAgcHJpdmF0ZSByZWFkb25seSBkZWJvdW5jZXIgPSBuZXcgU3ViamVjdDxhbnk+KCk7XG5cbiAgY29ubmVjdG9yczogQ29ubmVjdG9yc01vZGVsO1xuICBub2RlczogTm9kZXNNb2RlbDtcbiAgZWRnZXM6IEVkZ2VzTW9kZWw7XG5cbiAgY29uc3RydWN0b3IobW9kZWxWYWxpZGF0aW9uOiBGY01vZGVsVmFsaWRhdGlvblNlcnZpY2UsXG4gICAgICAgICAgICAgIG1vZGVsOiBGY01vZGVsLFxuICAgICAgICAgICAgICBtb2RlbENoYW5nZWQ6IEV2ZW50RW1pdHRlcjxhbnk+LFxuICAgICAgICAgICAgICBkZXRlY3RDaGFuZ2VzU3ViamVjdDogU3ViamVjdDxhbnk+LFxuICAgICAgICAgICAgICBzZWxlY3RlZE9iamVjdHM6IGFueVtdLFxuICAgICAgICAgICAgICBkcm9wTm9kZTogKGV2ZW50OiBFdmVudCwgbm9kZTogRmNOb2RlKSA9PiB2b2lkLFxuICAgICAgICAgICAgICBjcmVhdGVFZGdlOiAoZXZlbnQ6IEV2ZW50LCBlZGdlOiBGY0VkZ2UpID0+IE9ic2VydmFibGU8RmNFZGdlPixcbiAgICAgICAgICAgICAgZWRnZUFkZGVkQ2FsbGJhY2s6IChlZGdlOiBGY0VkZ2UpID0+IHZvaWQsXG4gICAgICAgICAgICAgIG5vZGVSZW1vdmVkQ2FsbGJhY2s6IChub2RlOiBGY05vZGUpID0+IHZvaWQsXG4gICAgICAgICAgICAgIGVkZ2VSZW1vdmVkQ2FsbGJhY2s6IChlZGdlOiBGY0VkZ2UpID0+IHZvaWQsXG4gICAgICAgICAgICAgIGNhbnZhc0h0bWxFbGVtZW50OiBIVE1MRWxlbWVudCxcbiAgICAgICAgICAgICAgc3ZnSHRtbEVsZW1lbnQ6IFNWR0VsZW1lbnQsXG4gICAgICAgICAgICAgIHZlcnRpY2FsZWRnZWVuYWJsZWQ6IGJvb2xlYW4pIHtcblxuICAgIHRoaXMubW9kZWxWYWxpZGF0aW9uID0gbW9kZWxWYWxpZGF0aW9uO1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgICB0aGlzLm1vZGVsQ2hhbmdlZCA9IG1vZGVsQ2hhbmdlZDtcbiAgICB0aGlzLmRldGVjdENoYW5nZXNTdWJqZWN0ID0gZGV0ZWN0Q2hhbmdlc1N1YmplY3Q7XG4gICAgdGhpcy5jYW52YXNIdG1sRWxlbWVudCA9IGNhbnZhc0h0bWxFbGVtZW50O1xuICAgIHRoaXMuc3ZnSHRtbEVsZW1lbnQgPSBzdmdIdG1sRWxlbWVudDtcbiAgICB0aGlzLm1vZGVsVmFsaWRhdGlvbi52YWxpZGF0ZU1vZGVsKHRoaXMubW9kZWwpO1xuICAgIHRoaXMuc2VsZWN0ZWRPYmplY3RzID0gc2VsZWN0ZWRPYmplY3RzO1xuICAgIHRoaXMudmVydGljYWxlZGdlZW5hYmxlZCA9IHZlcnRpY2FsZWRnZWVuYWJsZWQ7XG5cbiAgICB0aGlzLmRyb3BOb2RlID0gZHJvcE5vZGUgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLmNyZWF0ZUVkZ2UgPSBjcmVhdGVFZGdlIHx8ICgoZXZlbnQsIGVkZ2UpID0+IG9mKHsuLi5lZGdlLCBsYWJlbDogJ2xhYmVsJ30pKTtcbiAgICB0aGlzLmVkZ2VBZGRlZENhbGxiYWNrID0gZWRnZUFkZGVkQ2FsbGJhY2sgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLm5vZGVSZW1vdmVkQ2FsbGJhY2sgPSBub2RlUmVtb3ZlZENhbGxiYWNrIHx8ICgoKSA9PiB7fSk7XG4gICAgdGhpcy5lZGdlUmVtb3ZlZENhbGxiYWNrID0gZWRnZVJlbW92ZWRDYWxsYmFjayB8fCAoKCkgPT4ge30pO1xuXG4gICAgdGhpcy5jb25uZWN0b3JzID0gbmV3IENvbm5lY3RvcnNNb2RlbCh0aGlzKTtcbiAgICB0aGlzLm5vZGVzID0gbmV3IE5vZGVzTW9kZWwodGhpcyk7XG4gICAgdGhpcy5lZGdlcyA9IG5ldyBFZGdlc01vZGVsKHRoaXMpO1xuXG4gICAgdGhpcy5kZWJvdW5jZXJcbiAgICAgIC5waXBlKGRlYm91bmNlVGltZSgxMDApKVxuICAgICAgLnN1YnNjcmliZSgoKSA9PiB0aGlzLm1vZGVsQ2hhbmdlZC5lbWl0KCkpO1xuICB9XG5cbiAgcHVibGljIG5vdGlmeU1vZGVsQ2hhbmdlZCgpIHtcbiAgICB0aGlzLmRlYm91bmNlci5uZXh0KCk7XG4gIH1cblxuICBwdWJsaWMgZGV0ZWN0Q2hhbmdlcygpIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZGV0ZWN0Q2hhbmdlc1N1YmplY3QubmV4dCgpO1xuICAgIH0sIDApO1xuICB9XG5cbiAgcHVibGljIHNlbGVjdE9iamVjdChvYmplY3Q6IGFueSkge1xuICAgIGlmICh0aGlzLmlzRWRpdGFibGUoKSkge1xuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRPYmplY3RzLmluZGV4T2Yob2JqZWN0KSA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZE9iamVjdHMucHVzaChvYmplY3QpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBkZXNlbGVjdE9iamVjdChvYmplY3Q6IGFueSkge1xuICAgIGlmICh0aGlzLmlzRWRpdGFibGUoKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnNlbGVjdGVkT2JqZWN0cy5pbmRleE9mKG9iamVjdCk7XG4gICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVHJpZWQgdG8gZGVzZWxlY3QgYW4gdW5zZWxlY3RlZCBvYmplY3QnKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2VsZWN0ZWRPYmplY3RzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHRvZ2dsZVNlbGVjdGVkT2JqZWN0KG9iamVjdDogYW55KSB7XG4gICAgaWYgKHRoaXMuaXNTZWxlY3RlZE9iamVjdChvYmplY3QpKSB7XG4gICAgICB0aGlzLmRlc2VsZWN0T2JqZWN0KG9iamVjdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VsZWN0T2JqZWN0KG9iamVjdCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGlzU2VsZWN0ZWRPYmplY3Qob2JqZWN0OiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZE9iamVjdHMuaW5kZXhPZihvYmplY3QpICE9PSAtMTtcbiAgfVxuXG4gIHB1YmxpYyBzZWxlY3RBbGwoKSB7XG4gICAgdGhpcy5tb2RlbC5ub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgaWYgKCFub2RlLnJlYWRvbmx5KSB7XG4gICAgICAgIHRoaXMubm9kZXMuc2VsZWN0KG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMubW9kZWwuZWRnZXMuZm9yRWFjaChlZGdlID0+IHtcbiAgICAgIHRoaXMuZWRnZXMuc2VsZWN0KGVkZ2UpO1xuICAgIH0pO1xuICAgIHRoaXMuZGV0ZWN0Q2hhbmdlcygpO1xuICB9XG5cbiAgcHVibGljIGRlc2VsZWN0QWxsKCkge1xuICAgIHRoaXMuc2VsZWN0ZWRPYmplY3RzLnNwbGljZSgwLCB0aGlzLnNlbGVjdGVkT2JqZWN0cy5sZW5ndGgpO1xuICAgIHRoaXMuZGV0ZWN0Q2hhbmdlcygpO1xuICB9XG5cbiAgcHVibGljIGlzRWRpdE9iamVjdChvYmplY3Q6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdGVkT2JqZWN0cy5sZW5ndGggPT09IDEgJiZcbiAgICAgIHRoaXMuc2VsZWN0ZWRPYmplY3RzLmluZGV4T2Yob2JqZWN0KSAhPT0gLTE7XG4gIH1cblxuICBwcml2YXRlIGluUmVjdEJveCh4OiBudW1iZXIsIHk6IG51bWJlciwgcmVjdEJveDogRmNSZWN0Qm94KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHggPj0gcmVjdEJveC5sZWZ0ICYmIHggPD0gcmVjdEJveC5yaWdodCAmJlxuICAgICAgeSA+PSByZWN0Qm94LnRvcCAmJiB5IDw9IHJlY3RCb3guYm90dG9tO1xuICB9XG5cbiAgcHVibGljIGdldEl0ZW1JbmZvQXRQb2ludCh4OiBudW1iZXIsIHk6IG51bWJlcik6IEZjSXRlbUluZm8ge1xuICAgIHJldHVybiB7XG4gICAgICBub2RlOiB0aGlzLmdldE5vZGVBdFBvaW50KHgsIHkpLFxuICAgICAgZWRnZTogdGhpcy5nZXRFZGdlQXRQb2ludCh4LCB5KVxuICAgIH07XG4gIH1cblxuICBwdWJsaWMgZ2V0Tm9kZUF0UG9pbnQoeDogbnVtYmVyLCB5OiBudW1iZXIpOiBGY05vZGUge1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiB0aGlzLm1vZGVsLm5vZGVzKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5ub2Rlcy5nZXRIdG1sRWxlbWVudChub2RlLmlkKTtcbiAgICAgIGNvbnN0IG5vZGVFbGVtZW50Qm94ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICh4ID49IG5vZGVFbGVtZW50Qm94LmxlZnQgJiYgeCA8PSBub2RlRWxlbWVudEJveC5yaWdodFxuICAgICAgICAmJiB5ID49IG5vZGVFbGVtZW50Qm94LnRvcCAmJiB5IDw9IG5vZGVFbGVtZW50Qm94LmJvdHRvbSkge1xuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwdWJsaWMgZ2V0RWRnZUF0UG9pbnQoeDogbnVtYmVyLCB5OiBudW1iZXIpOiBGY0VkZ2Uge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICAgIGNvbnN0IGlkID0gZWxlbWVudC5pZDtcbiAgICBsZXQgZWRnZUluZGV4ID0gLTE7XG4gICAgaWYgKGlkKSB7XG4gICAgICBpZiAoaWQuc3RhcnRzV2l0aCgnZmMtZWRnZS1wYXRoLScpKSB7XG4gICAgICAgIGVkZ2VJbmRleCA9IE51bWJlcihpZC5zdWJzdHJpbmcoJ2ZjLWVkZ2UtcGF0aC0nLmxlbmd0aCkpO1xuICAgICAgfSBlbHNlIGlmIChpZC5zdGFydHNXaXRoKCdmYy1lZGdlLWxhYmVsLScpKSB7XG4gICAgICAgIGVkZ2VJbmRleCA9IE51bWJlcihpZC5zdWJzdHJpbmcoJ2ZjLWVkZ2UtbGFiZWwtJy5sZW5ndGgpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVkZ2VJbmRleCA+IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5lZGdlc1tlZGdlSW5kZXhdO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyBzZWxlY3RBbGxJblJlY3QocmVjdEJveDogRmNSZWN0Qm94KSB7XG4gICAgdGhpcy5tb2RlbC5ub2Rlcy5mb3JFYWNoKCh2YWx1ZSkgPT4ge1xuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubm9kZXMuZ2V0SHRtbEVsZW1lbnQodmFsdWUuaWQpO1xuICAgICAgY29uc3Qgbm9kZUVsZW1lbnRCb3ggPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKCF2YWx1ZS5yZWFkb25seSkge1xuICAgICAgICBjb25zdCB4ID0gbm9kZUVsZW1lbnRCb3gubGVmdCArIG5vZGVFbGVtZW50Qm94LndpZHRoIC8gMjtcbiAgICAgICAgY29uc3QgeSA9IG5vZGVFbGVtZW50Qm94LnRvcCArIG5vZGVFbGVtZW50Qm94LmhlaWdodCAvIDI7XG4gICAgICAgIGlmICh0aGlzLmluUmVjdEJveCh4LCB5LCByZWN0Qm94KSkge1xuICAgICAgICAgIHRoaXMubm9kZXMuc2VsZWN0KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodGhpcy5ub2Rlcy5pc1NlbGVjdGVkKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5ub2Rlcy5kZXNlbGVjdCh2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgY2FudmFzRWxlbWVudEJveCA9IHRoaXMuY2FudmFzSHRtbEVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGhpcy5tb2RlbC5lZGdlcy5mb3JFYWNoKCh2YWx1ZSkgPT4ge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmVkZ2VzLnNvdXJjZUNvb3JkKHZhbHVlKTtcbiAgICAgIGNvbnN0IGVuZCA9IHRoaXMuZWRnZXMuZGVzdENvb3JkKHZhbHVlKTtcbiAgICAgIGNvbnN0IHggPSAoc3RhcnQueCArIGVuZC54KSAvIDIgKyBjYW52YXNFbGVtZW50Qm94LmxlZnQ7XG4gICAgICBjb25zdCB5ID0gKHN0YXJ0LnkgKyBlbmQueSkgLyAyICsgY2FudmFzRWxlbWVudEJveC50b3A7XG4gICAgICBpZiAodGhpcy5pblJlY3RCb3goeCwgeSwgcmVjdEJveCkpIHtcbiAgICAgICAgdGhpcy5lZGdlcy5zZWxlY3QodmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuZWRnZXMuaXNTZWxlY3RlZCh2YWx1ZSkpIHtcbiAgICAgICAgICB0aGlzLmVkZ2VzLmRlc2VsZWN0KHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGRlbGV0ZVNlbGVjdGVkKCkge1xuICAgIGNvbnN0IGVkZ2VzVG9EZWxldGUgPSB0aGlzLmVkZ2VzLmdldFNlbGVjdGVkRWRnZXMoKTtcbiAgICBlZGdlc1RvRGVsZXRlLmZvckVhY2goKGVkZ2UpID0+IHtcbiAgICAgIHRoaXMuZWRnZXMuZGVsZXRlKGVkZ2UpO1xuICAgIH0pO1xuICAgIGNvbnN0IG5vZGVzVG9EZWxldGUgPSB0aGlzLm5vZGVzLmdldFNlbGVjdGVkTm9kZXMoKTtcbiAgICBub2Rlc1RvRGVsZXRlLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgIHRoaXMubm9kZXMuZGVsZXRlKG5vZGUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGlzRWRpdGFibGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZHJvcFRhcmdldElkID09PSB1bmRlZmluZWQ7XG4gIH1cblxuICBwdWJsaWMgaXNEcm9wU291cmNlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmRyb3BUYXJnZXRJZCAhPT0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHVibGljIGdldERyYWdJbWFnZSgpOiBIVE1MSW1hZ2VFbGVtZW50IHtcbiAgICBpZiAoIXRoaXMuZHJhZ0ltYWdlKSB7XG4gICAgICB0aGlzLmRyYWdJbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgdGhpcy5kcmFnSW1hZ2Uuc3JjID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCxSMGxHT0RsaEFRQUJBSUFBQUFBQUFQLy8veUg1QkFFQUFBQUFMQUFBQUFBQkFBRUFBQUlCUkFBNyc7XG4gICAgICB0aGlzLmRyYWdJbWFnZS5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmRyYWdJbWFnZTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSHRtbEVsZW1lbnRNYXAgeyBbaWQ6IHN0cmluZ106IEhUTUxFbGVtZW50OyB9XG5cbmludGVyZmFjZSBDb25uZWN0b3JSZWN0SW5mb01hcCB7IFtpZDogc3RyaW5nXTogRmNDb25uZWN0b3JSZWN0SW5mbzsgfVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEZjTW9kZWw8VD4ge1xuXG4gIG1vZGVsU2VydmljZTogRmNNb2RlbFNlcnZpY2U7XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKG1vZGVsU2VydmljZTogRmNNb2RlbFNlcnZpY2UpIHtcbiAgICB0aGlzLm1vZGVsU2VydmljZSA9IG1vZGVsU2VydmljZTtcbiAgfVxuXG4gIHB1YmxpYyBzZWxlY3Qob2JqZWN0OiBUKSB7XG4gICAgdGhpcy5tb2RlbFNlcnZpY2Uuc2VsZWN0T2JqZWN0KG9iamVjdCk7XG4gIH1cblxuICBwdWJsaWMgZGVzZWxlY3Qob2JqZWN0OiBUKSB7XG4gICAgdGhpcy5tb2RlbFNlcnZpY2UuZGVzZWxlY3RPYmplY3Qob2JqZWN0KTtcbiAgfVxuXG4gIHB1YmxpYyB0b2dnbGVTZWxlY3RlZChvYmplY3Q6IFQpIHtcbiAgICB0aGlzLm1vZGVsU2VydmljZS50b2dnbGVTZWxlY3RlZE9iamVjdChvYmplY3QpO1xuICB9XG5cbiAgcHVibGljIGlzU2VsZWN0ZWQob2JqZWN0OiBUKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxTZXJ2aWNlLmlzU2VsZWN0ZWRPYmplY3Qob2JqZWN0KTtcbiAgfVxuXG4gIHB1YmxpYyBpc0VkaXQob2JqZWN0OiBUKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxTZXJ2aWNlLmlzRWRpdE9iamVjdChvYmplY3QpO1xuICB9XG59XG5cbmNsYXNzIENvbm5lY3RvcnNNb2RlbCBleHRlbmRzIEFic3RyYWN0RmNNb2RlbDxGY0Nvbm5lY3Rvcj4ge1xuXG4gIGNvbnN0cnVjdG9yKG1vZGVsU2VydmljZTogRmNNb2RlbFNlcnZpY2UpIHtcbiAgICBzdXBlcihtb2RlbFNlcnZpY2UpO1xuICB9XG5cbiAgcHVibGljIGdldENvbm5lY3Rvcihjb25uZWN0b3JJZDogc3RyaW5nKTogRmNDb25uZWN0b3Ige1xuICAgIGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UubW9kZWw7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG1vZGVsLm5vZGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm5lY3RvciBvZiBub2RlLmNvbm5lY3RvcnMpIHtcbiAgICAgICAgaWYgKGNvbm5lY3Rvci5pZCA9PT0gY29ubmVjdG9ySWQpIHtcbiAgICAgICAgICByZXR1cm4gY29ubmVjdG9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGdldENvbm5lY3RvclJlY3RJbmZvKGNvbm5lY3RvcklkOiBzdHJpbmcpOiBGY0Nvbm5lY3RvclJlY3RJbmZvIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbFNlcnZpY2UuY29ubmVjdG9yc1JlY3RJbmZvc1tjb25uZWN0b3JJZF07XG4gIH1cblxuICBwdWJsaWMgc2V0Q29ubmVjdG9yUmVjdEluZm8oY29ubmVjdG9ySWQ6IHN0cmluZywgY29ubmVjdG9yUmVjdEluZm86IEZjQ29ubmVjdG9yUmVjdEluZm8pIHtcbiAgICB0aGlzLm1vZGVsU2VydmljZS5jb25uZWN0b3JzUmVjdEluZm9zW2Nvbm5lY3RvcklkXSA9IGNvbm5lY3RvclJlY3RJbmZvO1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLmRldGVjdENoYW5nZXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldENvb3Jkcyhjb25uZWN0b3JJZDogc3RyaW5nLCBjZW50ZXJlZD86IGJvb2xlYW4pOiBGY0Nvb3JkcyB7XG4gICAgY29uc3QgY29ubmVjdG9yUmVjdEluZm8gPSB0aGlzLmdldENvbm5lY3RvclJlY3RJbmZvKGNvbm5lY3RvcklkKTtcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLm1vZGVsU2VydmljZS5jYW52YXNIdG1sRWxlbWVudDtcbiAgICBpZiAoY29ubmVjdG9yUmVjdEluZm8gPT09IG51bGwgfHwgY29ubmVjdG9yUmVjdEluZm8gPT09IHVuZGVmaW5lZCB8fCBjYW52YXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB7eDogMCwgeTogMH07XG4gICAgfVxuICAgIGlmKHRoaXMubW9kZWxTZXJ2aWNlLnZlcnRpY2FsZWRnZWVuYWJsZWQpIHtcbiAgICAgIGxldCB4ID0gY29ubmVjdG9yUmVjdEluZm8ubm9kZVJlY3RJbmZvLmxlZnQoKSArIChjb25uZWN0b3JSZWN0SW5mby5ub2RlUmVjdEluZm8ud2lkdGgoKSAvIDIpIDtcbiAgICAgIGxldCB5ID0gY29ubmVjdG9yUmVjdEluZm8udHlwZSA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmxlZnRDb25uZWN0b3JUeXBlID9cbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdG9yUmVjdEluZm8ubm9kZVJlY3RJbmZvLnRvcCgpIDogY29ubmVjdG9yUmVjdEluZm8ubm9kZVJlY3RJbmZvLmJvdHRvbSgpO1xuICAgICAgaWYgKCFjZW50ZXJlZCkge1xuICAgICAgICB4IC09IGNvbm5lY3RvclJlY3RJbmZvLndpZHRoIC8gMjtcbiAgICAgICAgeSAtPSBjb25uZWN0b3JSZWN0SW5mby5oZWlnaHQgLyAyO1xuICAgICAgfVxuICAgICAgY29uc3QgY29vcmRzOiBGY0Nvb3JkcyA9IHtcbiAgICAgICAgeDogTWF0aC5yb3VuZCh4KSxcbiAgICAgICAgeTogTWF0aC5yb3VuZCh5KVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjb29yZHM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB4ID0gY29ubmVjdG9yUmVjdEluZm8udHlwZSA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmxlZnRDb25uZWN0b3JUeXBlID9cbiAgICAgICAgY29ubmVjdG9yUmVjdEluZm8ubm9kZVJlY3RJbmZvLmxlZnQoKSA6IGNvbm5lY3RvclJlY3RJbmZvLm5vZGVSZWN0SW5mby5yaWdodCgpO1xuICAgICAgbGV0IHkgPSBjb25uZWN0b3JSZWN0SW5mby5ub2RlUmVjdEluZm8udG9wKCkgKyBjb25uZWN0b3JSZWN0SW5mby5ub2RlUmVjdEluZm8uaGVpZ2h0KCkgLyAyO1xuICAgICAgaWYgKCFjZW50ZXJlZCkge1xuICAgICAgICB4IC09IGNvbm5lY3RvclJlY3RJbmZvLndpZHRoIC8gMjtcbiAgICAgICAgeSAtPSBjb25uZWN0b3JSZWN0SW5mby5oZWlnaHQgLyAyO1xuICAgICAgfVxuICAgICAgY29uc3QgY29vcmRzOiBGY0Nvb3JkcyA9IHtcbiAgICAgICAgeDogTWF0aC5yb3VuZCh4KSxcbiAgICAgICAgeTogTWF0aC5yb3VuZCh5KVxuICAgICAgfTtcbiAgICAgIHJldHVybiBjb29yZHM7XG4gICAgfVxuXG4gIH1cblxuICBwdWJsaWMgZ2V0Q29vcmRzKGNvbm5lY3RvcklkOiBzdHJpbmcpOiBGY0Nvb3JkcyB7XG4gICAgcmV0dXJuIHRoaXMuX2dldENvb3Jkcyhjb25uZWN0b3JJZCwgZmFsc2UpO1xuICB9XG5cbiAgcHVibGljIGdldENlbnRlcmVkQ29vcmQoY29ubmVjdG9ySWQ6IHN0cmluZyk6IEZjQ29vcmRzIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0Q29vcmRzKGNvbm5lY3RvcklkLCB0cnVlKTtcbiAgfVxufVxuXG5jbGFzcyBOb2Rlc01vZGVsIGV4dGVuZHMgQWJzdHJhY3RGY01vZGVsPEZjTm9kZT4ge1xuXG4gIGNvbnN0cnVjdG9yKG1vZGVsU2VydmljZTogRmNNb2RlbFNlcnZpY2UpIHtcbiAgICBzdXBlcihtb2RlbFNlcnZpY2UpO1xuICB9XG5cbiAgcHVibGljIGdldENvbm5lY3RvcnNCeVR5cGUobm9kZTogRmNOb2RlLCB0eXBlOiBzdHJpbmcpOiBBcnJheTxGY0Nvbm5lY3Rvcj4ge1xuICAgIHJldHVybiBub2RlLmNvbm5lY3RvcnMuZmlsdGVyKChjb25uZWN0b3IpID0+IHtcbiAgICAgIHJldHVybiBjb25uZWN0b3IudHlwZSA9PT0gdHlwZTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZENvbm5lY3Rvcihub2RlOiBGY05vZGUsIGNvbm5lY3RvcjogRmNDb25uZWN0b3IpIHtcbiAgICBub2RlLmNvbm5lY3RvcnMucHVzaChjb25uZWN0b3IpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLm1vZGVsU2VydmljZS5tb2RlbFZhbGlkYXRpb24udmFsaWRhdGVOb2RlKG5vZGUpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBub2RlLmNvbm5lY3RvcnMuc3BsaWNlKG5vZGUuY29ubmVjdG9ycy5pbmRleE9mKGNvbm5lY3RvciksIDEpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGRlbGV0ZShub2RlOiBGY05vZGUpIHtcbiAgICBpZiAodGhpcy5pc1NlbGVjdGVkKG5vZGUpKSB7XG4gICAgICB0aGlzLmRlc2VsZWN0KG5vZGUpO1xuICAgIH1cbiAgICBjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLm1vZGVsO1xuICAgIGNvbnN0IGluZGV4ID0gbW9kZWwubm9kZXMuaW5kZXhPZihub2RlKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBpZiAobm9kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIHVuZGVmaW5lZCcpO1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUcmllZCB0byBkZWxldGUgbm90IGV4aXN0aW5nIG5vZGUnKTtcbiAgICB9XG4gICAgY29uc3QgY29ubmVjdG9ySWRzID0gdGhpcy5nZXRDb25uZWN0b3JJZHMobm9kZSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtb2RlbC5lZGdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZWRnZSA9IG1vZGVsLmVkZ2VzW2ldO1xuICAgICAgaWYgKGNvbm5lY3Rvcklkcy5pbmRleE9mKGVkZ2Uuc291cmNlKSAhPT0gLTEgfHwgY29ubmVjdG9ySWRzLmluZGV4T2YoZWRnZS5kZXN0aW5hdGlvbikgIT09IC0xKSB7XG4gICAgICAgIHRoaXMubW9kZWxTZXJ2aWNlLmVkZ2VzLmRlbGV0ZShlZGdlKTtcbiAgICAgICAgaS0tO1xuICAgICAgfVxuICAgIH1cbiAgICBtb2RlbC5ub2Rlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLm5vdGlmeU1vZGVsQ2hhbmdlZCgpO1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLm5vZGVSZW1vdmVkQ2FsbGJhY2sobm9kZSk7XG4gIH1cblxuICBwdWJsaWMgZ2V0U2VsZWN0ZWROb2RlcygpOiBBcnJheTxGY05vZGU+IHtcbiAgICBjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLm1vZGVsO1xuICAgIHJldHVybiBtb2RlbC5ub2Rlcy5maWx0ZXIoKG5vZGUpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsU2VydmljZS5ub2Rlcy5pc1NlbGVjdGVkKG5vZGUpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGhhbmRsZUNsaWNrZWQobm9kZTogRmNOb2RlLCBjdHJsS2V5PzogYm9vbGVhbikge1xuICAgIGlmIChjdHJsS2V5KSB7XG4gICAgICB0aGlzLm1vZGVsU2VydmljZS5ub2Rlcy50b2dnbGVTZWxlY3RlZChub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tb2RlbFNlcnZpY2UuZGVzZWxlY3RBbGwoKTtcbiAgICAgIHRoaXMubW9kZWxTZXJ2aWNlLm5vZGVzLnNlbGVjdChub2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hZGROb2RlKG5vZGU6IEZjTm9kZSkge1xuICAgIGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UubW9kZWw7XG4gICAgdHJ5IHtcbiAgICAgIG1vZGVsLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB0aGlzLm1vZGVsU2VydmljZS5tb2RlbFZhbGlkYXRpb24udmFsaWRhdGVOb2Rlcyhtb2RlbC5ub2Rlcyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG1vZGVsLm5vZGVzLnNwbGljZShtb2RlbC5ub2Rlcy5pbmRleE9mKG5vZGUpLCAxKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBnZXRDb25uZWN0b3JJZHMobm9kZTogRmNOb2RlKTogQXJyYXk8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5vZGUuY29ubmVjdG9ycy5tYXAoKGNvbm5lY3RvcikgPT4ge1xuICAgICAgcmV0dXJuIGNvbm5lY3Rvci5pZDtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBnZXROb2RlQnlDb25uZWN0b3JJZChjb25uZWN0b3JJZDogc3RyaW5nKTogRmNOb2RlIHtcbiAgICBjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLm1vZGVsO1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBtb2RlbC5ub2Rlcykge1xuICAgICAgY29uc3QgY29ubmVjdG9ySWRzID0gdGhpcy5nZXRDb25uZWN0b3JJZHMobm9kZSk7XG4gICAgICBpZiAoY29ubmVjdG9ySWRzLmluZGV4T2YoY29ubmVjdG9ySWQpID4gLTEpIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHVibGljIGdldEh0bWxFbGVtZW50KG5vZGVJZDogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLm1vZGVsU2VydmljZS5ub2Rlc0h0bWxFbGVtZW50c1tub2RlSWRdO1xuICB9XG5cbiAgcHVibGljIHNldEh0bWxFbGVtZW50KG5vZGVJZDogc3RyaW5nLCBlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLm5vZGVzSHRtbEVsZW1lbnRzW25vZGVJZF0gPSBlbGVtZW50O1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLmRldGVjdENoYW5nZXMoKTtcbiAgfVxuXG59XG5cbmNsYXNzIEVkZ2VzTW9kZWwgZXh0ZW5kcyBBYnN0cmFjdEZjTW9kZWw8RmNFZGdlPiB7XG5cbiAgY29uc3RydWN0b3IobW9kZWxTZXJ2aWNlOiBGY01vZGVsU2VydmljZSkge1xuICAgIHN1cGVyKG1vZGVsU2VydmljZSk7XG4gIH1cblxuICBwdWJsaWMgc291cmNlQ29vcmQoZWRnZTogRmNFZGdlKTogRmNDb29yZHMge1xuICAgIHJldHVybiB0aGlzLm1vZGVsU2VydmljZS5jb25uZWN0b3JzLmdldENlbnRlcmVkQ29vcmQoZWRnZS5zb3VyY2UpO1xuICB9XG5cbiAgcHVibGljIGRlc3RDb29yZChlZGdlOiBGY0VkZ2UpOiBGY0Nvb3JkcyB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxTZXJ2aWNlLmNvbm5lY3RvcnMuZ2V0Q2VudGVyZWRDb29yZChlZGdlLmRlc3RpbmF0aW9uKTtcbiAgfVxuXG4gIHB1YmxpYyBkZWxldGUoZWRnZTogRmNFZGdlKSB7XG4gICAgY29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5tb2RlbDtcbiAgICBjb25zdCBpbmRleCA9IG1vZGVsLmVkZ2VzLmluZGV4T2YoZWRnZSk7XG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUcmllZCB0byBkZWxldGUgbm90IGV4aXN0aW5nIGVkZ2UnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXNTZWxlY3RlZChlZGdlKSkge1xuICAgICAgdGhpcy5kZXNlbGVjdChlZGdlKTtcbiAgICB9XG4gICAgbW9kZWwuZWRnZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB0aGlzLm1vZGVsU2VydmljZS5ub3RpZnlNb2RlbENoYW5nZWQoKTtcbiAgICB0aGlzLm1vZGVsU2VydmljZS5lZGdlUmVtb3ZlZENhbGxiYWNrKGVkZ2UpO1xuICB9XG5cbiAgcHVibGljIGdldFNlbGVjdGVkRWRnZXMoKTogQXJyYXk8RmNFZGdlPiB7XG4gICAgY29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5tb2RlbDtcbiAgICByZXR1cm4gbW9kZWwuZWRnZXMuZmlsdGVyKChlZGdlKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbFNlcnZpY2UuZWRnZXMuaXNTZWxlY3RlZChlZGdlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBoYW5kbGVFZGdlTW91c2VDbGljayhlZGdlOiBGY0VkZ2UsIGN0cmxLZXk/OiBib29sZWFuKSB7XG4gICAgaWYgKGN0cmxLZXkpIHtcbiAgICAgIHRoaXMubW9kZWxTZXJ2aWNlLmVkZ2VzLnRvZ2dsZVNlbGVjdGVkKGVkZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1vZGVsU2VydmljZS5kZXNlbGVjdEFsbCgpO1xuICAgICAgdGhpcy5tb2RlbFNlcnZpY2UuZWRnZXMuc2VsZWN0KGVkZ2UpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBwdXRFZGdlKGVkZ2U6IEZjRWRnZSkge1xuICAgIGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UubW9kZWw7XG4gICAgbW9kZWwuZWRnZXMucHVzaChlZGdlKTtcbiAgICB0aGlzLm1vZGVsU2VydmljZS5ub3RpZnlNb2RlbENoYW5nZWQoKTtcbiAgfVxuXG4gIHB1YmxpYyBfYWRkRWRnZShldmVudDogRXZlbnQsIHNvdXJjZUNvbm5lY3RvcjogRmNDb25uZWN0b3IsIGRlc3RDb25uZWN0b3I6IEZjQ29ubmVjdG9yLCBsYWJlbDogc3RyaW5nKSB7XG4gICAgdGhpcy5tb2RlbFNlcnZpY2UubW9kZWxWYWxpZGF0aW9uLnZhbGlkYXRlQ29ubmVjdG9yKHNvdXJjZUNvbm5lY3Rvcik7XG4gICAgdGhpcy5tb2RlbFNlcnZpY2UubW9kZWxWYWxpZGF0aW9uLnZhbGlkYXRlQ29ubmVjdG9yKGRlc3RDb25uZWN0b3IpO1xuICAgIGNvbnN0IGVkZ2U6IEZjRWRnZSA9IHt9O1xuICAgIGVkZ2Uuc291cmNlID0gc291cmNlQ29ubmVjdG9yLmlkO1xuICAgIGVkZ2UuZGVzdGluYXRpb24gPSBkZXN0Q29ubmVjdG9yLmlkO1xuICAgIGVkZ2UubGFiZWwgPSBsYWJlbDtcbiAgICBjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLm1vZGVsO1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLm1vZGVsVmFsaWRhdGlvbi52YWxpZGF0ZUVkZ2VzKG1vZGVsLmVkZ2VzLmNvbmNhdChbZWRnZV0pLCBtb2RlbC5ub2Rlcyk7XG4gICAgdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlRWRnZShldmVudCwgZWRnZSkuc3Vic2NyaWJlKFxuICAgICAgKGNyZWF0ZWQpID0+IHtcbiAgICAgICAgbW9kZWwuZWRnZXMucHVzaChjcmVhdGVkKTtcbiAgICAgICAgdGhpcy5tb2RlbFNlcnZpY2Uubm90aWZ5TW9kZWxDaGFuZ2VkKCk7XG4gICAgICAgIHRoaXMubW9kZWxTZXJ2aWNlLmVkZ2VBZGRlZENhbGxiYWNrKGNyZWF0ZWQpO1xuICAgICAgfVxuICAgICk7XG4gIH1cbn1cbiJdfQ==