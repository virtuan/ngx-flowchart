import { FlowchartConstants, ModelvalidationError } from './ngx-flowchart.models';
export class FcEdgeDraggingService {
    constructor(modelValidation, edgeDrawingService, modelService, model, isValidEdgeCallback, applyFunction, dragAnimation, edgeStyle, verticaledgeenabled) {
        this.edgeDragging = {
            isDragging: false,
            dragPoint1: null,
            dragPoint2: null,
            shadowDragStarted: false
        };
        this.draggedEdgeSource = null;
        this.dragOffset = {};
        this.destinationHtmlElement = null;
        this.oldDisplayStyle = '';
        this.modelValidation = modelValidation;
        this.edgeDrawingService = edgeDrawingService;
        this.modelService = modelService;
        this.model = model;
        this.isValidEdgeCallback = isValidEdgeCallback || (() => true);
        this.applyFunction = applyFunction;
        this.dragAnimation = dragAnimation;
        this.edgeStyle = edgeStyle;
        this.verticaledgeenabled = verticaledgeenabled;
    }
    dragstart(event, connector) {
        let swapConnector;
        let dragLabel;
        let prevEdge;
        if (connector.type === FlowchartConstants.leftConnectorType) {
            for (const edge of this.model.edges) {
                if (edge.destination === connector.id) {
                    swapConnector = this.modelService.connectors.getConnector(edge.source);
                    dragLabel = edge.label;
                    prevEdge = edge;
                    this.applyFunction(() => {
                        this.modelService.edges.delete(edge);
                    });
                    break;
                }
            }
        }
        this.edgeDragging.isDragging = true;
        if (swapConnector !== undefined) {
            this.draggedEdgeSource = swapConnector;
            this.edgeDragging.dragPoint1 = this.modelService.connectors.getCenteredCoord(swapConnector.id);
            this.edgeDragging.dragLabel = dragLabel;
            this.edgeDragging.prevEdge = prevEdge;
        }
        else {
            this.draggedEdgeSource = connector;
            this.edgeDragging.dragPoint1 = this.modelService.connectors.getCenteredCoord(connector.id);
        }
        const canvas = this.modelService.canvasHtmlElement;
        if (!canvas) {
            throw new Error('No canvas while edgedraggingService found.');
        }
        this.dragOffset.x = -canvas.getBoundingClientRect().left;
        this.dragOffset.y = -canvas.getBoundingClientRect().top;
        this.edgeDragging.dragPoint2 = {
            x: event.clientX + this.dragOffset.x,
            y: event.clientY + this.dragOffset.y
        };
        const originalEvent = event.originalEvent || event;
        originalEvent.dataTransfer.setData('Text', 'Just to support firefox');
        if (originalEvent.dataTransfer.setDragImage) {
            originalEvent.dataTransfer.setDragImage(this.modelService.getDragImage(), 0, 0);
        }
        else {
            this.destinationHtmlElement = event.target;
            this.oldDisplayStyle = this.destinationHtmlElement.style.display;
            this.destinationHtmlElement.style.display = 'none';
            if (this.dragAnimation === FlowchartConstants.dragAnimationShadow) {
                this.edgeDragging.shadowDragStarted = true;
            }
        }
        if (this.dragAnimation === FlowchartConstants.dragAnimationShadow) {
            if (this.edgeDragging.gElement === undefined) {
                this.edgeDragging.gElement = $(document.querySelectorAll('.shadow-svg-class'));
                this.edgeDragging.pathElement = $(document.querySelectorAll('.shadow-svg-class')).find('path');
                this.edgeDragging.circleElement = $(document.querySelectorAll('.shadow-svg-class')).find('circle');
            }
            this.edgeDragging.gElement.css('display', 'block');
            this.edgeDragging.pathElement.attr('d', this.edgeDrawingService.getEdgeDAttribute(this.edgeDragging.dragPoint1, this.edgeDragging.dragPoint2, this.edgeStyle, this.verticaledgeenabled));
            this.edgeDragging.circleElement.attr('cx', this.edgeDragging.dragPoint2.x);
            this.edgeDragging.circleElement.attr('cy', this.edgeDragging.dragPoint2.y);
        }
        event.stopPropagation();
    }
    dragover(event) {
        if (this.edgeDragging.isDragging) {
            if (!this.edgeDragging.magnetActive && this.dragAnimation === FlowchartConstants.dragAnimationShadow) {
                if (this.destinationHtmlElement !== null) {
                    this.destinationHtmlElement.style.display = this.oldDisplayStyle;
                }
                if (this.edgeDragging.shadowDragStarted) {
                    this.applyFunction(() => {
                        this.edgeDragging.shadowDragStarted = false;
                    });
                }
                this.edgeDragging.dragPoint2 = {
                    x: event.clientX + this.dragOffset.x,
                    y: event.clientY + this.dragOffset.y
                };
                this.edgeDragging.pathElement.attr('d', this.edgeDrawingService.getEdgeDAttribute(this.edgeDragging.dragPoint1, this.edgeDragging.dragPoint2, this.edgeStyle, this.verticaledgeenabled));
                this.edgeDragging.circleElement.attr('cx', this.edgeDragging.dragPoint2.x);
                this.edgeDragging.circleElement.attr('cy', this.edgeDragging.dragPoint2.y);
            }
            else if (this.dragAnimation === FlowchartConstants.dragAnimationRepaint) {
                return this.applyFunction(() => {
                    if (this.destinationHtmlElement !== null) {
                        this.destinationHtmlElement.style.display = this.oldDisplayStyle;
                    }
                    this.edgeDragging.dragPoint2 = {
                        x: event.clientX + this.dragOffset.x,
                        y: event.clientY + this.dragOffset.y
                    };
                });
            }
        }
    }
    dragoverConnector(event, connector) {
        if (this.edgeDragging.isDragging) {
            this.dragover(event);
            try {
                this.modelValidation.validateEdges(this.model.edges.concat([{
                        source: this.draggedEdgeSource.id,
                        destination: connector.id
                    }]), this.model.nodes);
            }
            catch (error) {
                if (error instanceof ModelvalidationError) {
                    return true;
                }
                else {
                    throw error;
                }
            }
            if (this.isValidEdgeCallback(this.draggedEdgeSource, connector)) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        }
    }
    dragleaveMagnet(event) {
        this.edgeDragging.magnetActive = false;
    }
    dragoverMagnet(event, connector) {
        if (this.edgeDragging.isDragging) {
            this.dragover(event);
            try {
                this.modelValidation.validateEdges(this.model.edges.concat([{
                        source: this.draggedEdgeSource.id,
                        destination: connector.id
                    }]), this.model.nodes);
            }
            catch (error) {
                if (error instanceof ModelvalidationError) {
                    return true;
                }
                else {
                    throw error;
                }
            }
            if (this.isValidEdgeCallback(this.draggedEdgeSource, connector)) {
                if (this.dragAnimation === FlowchartConstants.dragAnimationShadow) {
                    this.edgeDragging.magnetActive = true;
                    this.edgeDragging.dragPoint2 = this.modelService.connectors.getCenteredCoord(connector.id);
                    this.edgeDragging.pathElement.attr('d', this.edgeDrawingService.getEdgeDAttribute(this.edgeDragging.dragPoint1, this.edgeDragging.dragPoint2, this.edgeStyle, this.verticaledgeenabled));
                    this.edgeDragging.circleElement.attr('cx', this.edgeDragging.dragPoint2.x);
                    this.edgeDragging.circleElement.attr('cy', this.edgeDragging.dragPoint2.y);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
                else if (this.dragAnimation === FlowchartConstants.dragAnimationRepaint) {
                    return this.applyFunction(() => {
                        this.edgeDragging.dragPoint2 = this.modelService.connectors.getCenteredCoord(connector.id);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    });
                }
            }
        }
    }
    dragend(event) {
        if (this.edgeDragging.isDragging) {
            this.edgeDragging.isDragging = false;
            this.edgeDragging.dragPoint1 = null;
            this.edgeDragging.dragPoint2 = null;
            this.edgeDragging.dragLabel = null;
            event.stopPropagation();
            if (this.dragAnimation === FlowchartConstants.dragAnimationShadow) {
                this.edgeDragging.gElement.css('display', 'none');
            }
            if (this.edgeDragging.prevEdge) {
                const edge = this.edgeDragging.prevEdge;
                this.edgeDragging.prevEdge = null;
                this.applyFunction(() => {
                    this.modelService.edges.putEdge(edge);
                });
            }
        }
    }
    drop(event, targetConnector) {
        if (this.edgeDragging.isDragging) {
            try {
                this.modelValidation.validateEdges(this.model.edges.concat([{
                        source: this.draggedEdgeSource.id,
                        destination: targetConnector.id
                    }]), this.model.nodes);
            }
            catch (error) {
                if (error instanceof ModelvalidationError) {
                    return true;
                }
                else {
                    throw error;
                }
            }
            if (this.isValidEdgeCallback(this.draggedEdgeSource, targetConnector)) {
                this.edgeDragging.prevEdge = null;
                this.modelService.edges._addEdge(event, this.draggedEdgeSource, targetConnector, this.edgeDragging.dragLabel);
                event.stopPropagation();
                event.preventDefault();
                return false;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRnZS1kcmFnZ2luZy5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWZsb3djaGFydC9zcmMvbGliL2VkZ2UtZHJhZ2dpbmcuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQTBDLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFJMUgsTUFBTSxPQUFPLHFCQUFxQjtJQXdCaEMsWUFBWSxlQUF5QyxFQUN6QyxrQkFBd0MsRUFDeEMsWUFBNEIsRUFDNUIsS0FBYyxFQUNkLG1CQUErRSxFQUMvRSxhQUFrRCxFQUNsRCxhQUFxQixFQUNyQixTQUFpQixFQUNqQixtQkFBNEI7UUE5QnhDLGlCQUFZLEdBQWlCO1lBQzNCLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLGlCQUFpQixFQUFFLEtBQUs7U0FDekIsQ0FBQztRQUVNLHNCQUFpQixHQUFnQixJQUFJLENBQUM7UUFDdEMsZUFBVSxHQUFhLEVBQUUsQ0FBQztRQUMxQiwyQkFBc0IsR0FBZ0IsSUFBSSxDQUFDO1FBQzNDLG9CQUFlLEdBQUcsRUFBRSxDQUFDO1FBcUIzQixJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUN2QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUM7UUFDN0MsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLG1CQUFtQixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFD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RUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM5RyxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3hCLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDdkIsT0FBTyxLQUFLLENBQUM7YUFDZDtTQUNGO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRmNNb2RlbFNlcnZpY2UgfSBmcm9tICcuL21vZGVsLnNlcnZpY2UnO1xuaW1wb3J0IHsgRmNDb25uZWN0b3IsIEZjQ29vcmRzLCBGY0VkZ2UsIEZjTW9kZWwsIEZsb3djaGFydENvbnN0YW50cywgTW9kZWx2YWxpZGF0aW9uRXJyb3IgfSBmcm9tICcuL25neC1mbG93Y2hhcnQubW9kZWxzJztcbmltcG9ydCB7IEZjRWRnZURyYXdpbmdTZXJ2aWNlIH0gZnJvbSAnLi9lZGdlLWRyYXdpbmcuc2VydmljZSc7XG5pbXBvcnQgeyBGY01vZGVsVmFsaWRhdGlvblNlcnZpY2UgfSBmcm9tICcuL21vZGVsdmFsaWRhdGlvbi5zZXJ2aWNlJztcblxuZXhwb3J0IGNsYXNzIEZjRWRnZURyYWdnaW5nU2VydmljZSB7XG5cbiAgZWRnZURyYWdnaW5nOiBFZGdlRHJhZ2dpbmcgPSB7XG4gICAgaXNEcmFnZ2luZzogZmFsc2UsXG4gICAgZHJhZ1BvaW50MTogbnVsbCxcbiAgICBkcmFnUG9pbnQyOiBudWxsLFxuICAgIHNoYWRvd0RyYWdTdGFydGVkOiBmYWxzZVxuICB9O1xuXG4gIHByaXZhdGUgZHJhZ2dlZEVkZ2VTb3VyY2U6IEZjQ29ubmVjdG9yID0gbnVsbDtcbiAgcHJpdmF0ZSBkcmFnT2Zmc2V0OiBGY0Nvb3JkcyA9IHt9O1xuICBwcml2YXRlIGRlc3RpbmF0aW9uSHRtbEVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gbnVsbDtcbiAgcHJpdmF0ZSBvbGREaXNwbGF5U3R5bGUgPSAnJztcblxuICBwcml2YXRlIHJlYWRvbmx5IG1vZGVsVmFsaWRhdGlvbjogRmNNb2RlbFZhbGlkYXRpb25TZXJ2aWNlO1xuICBwcml2YXRlIHJlYWRvbmx5IGVkZ2VEcmF3aW5nU2VydmljZTogRmNFZGdlRHJhd2luZ1NlcnZpY2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBGY01vZGVsU2VydmljZTtcbiAgcHJpdmF0ZSByZWFkb25seSBtb2RlbDogRmNNb2RlbDtcbiAgcHJpdmF0ZSByZWFkb25seSBpc1ZhbGlkRWRnZUNhbGxiYWNrOiAoc291cmNlOiBGY0Nvbm5lY3RvciwgZGVzdGluYXRpb246IEZjQ29ubmVjdG9yKSA9PiBib29sZWFuO1xuICBwcml2YXRlIHJlYWRvbmx5IGFwcGx5RnVuY3Rpb246IDxUPihmbjogKC4uLmFyZ3M6IGFueVtdKSA9PiBUKSA9PiBUO1xuICBwcml2YXRlIHJlYWRvbmx5IGRyYWdBbmltYXRpb246IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBlZGdlU3R5bGU6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSB2ZXJ0aWNhbGVkZ2VlbmFibGVkOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKG1vZGVsVmFsaWRhdGlvbjogRmNNb2RlbFZhbGlkYXRpb25TZXJ2aWNlLFxuICAgICAgICAgICAgICBlZGdlRHJhd2luZ1NlcnZpY2U6IEZjRWRnZURyYXdpbmdTZXJ2aWNlLFxuICAgICAgICAgICAgICBtb2RlbFNlcnZpY2U6IEZjTW9kZWxTZXJ2aWNlLFxuICAgICAgICAgICAgICBtb2RlbDogRmNNb2RlbCxcbiAgICAgICAgICAgICAgaXNWYWxpZEVkZ2VDYWxsYmFjazogKHNvdXJjZTogRmNDb25uZWN0b3IsIGRlc3RpbmF0aW9uOiBGY0Nvbm5lY3RvcikgPT4gYm9vbGVhbixcbiAgICAgICAgICAgICAgYXBwbHlGdW5jdGlvbjogPFQ+KGZuOiAoLi4uYXJnczogYW55W10pID0+IFQpID0+IFQsXG4gICAgICAgICAgICAgIGRyYWdBbmltYXRpb246IHN0cmluZyxcbiAgICAgICAgICAgICAgZWRnZVN0eWxlOiBzdHJpbmcsXG4gICAgICAgICAgICAgIHZlcnRpY2FsZWRnZWVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLm1vZGVsVmFsaWRhdGlvbiA9IG1vZGVsVmFsaWRhdGlvbjtcbiAgICB0aGlzLmVkZ2VEcmF3aW5nU2VydmljZSA9IGVkZ2VEcmF3aW5nU2VydmljZTtcbiAgICB0aGlzLm1vZGVsU2VydmljZSA9IG1vZGVsU2VydmljZTtcbiAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG4gICAgdGhpcy5pc1ZhbGlkRWRnZUNhbGxiYWNrID0gaXNWYWxpZEVkZ2VDYWxsYmFjayB8fCAoKCkgPT4gdHJ1ZSk7XG4gICAgdGhpcy5hcHBseUZ1bmN0aW9uID0gYXBwbHlGdW5jdGlvbjtcbiAgICB0aGlzLmRyYWdBbmltYXRpb24gPSBkcmFnQW5pbWF0aW9uO1xuICAgIHRoaXMuZWRnZVN0eWxlID0gZWRnZVN0eWxlO1xuICAgIHRoaXMudmVydGljYWxlZGdlZW5hYmxlZCA9IHZlcnRpY2FsZWRnZWVuYWJsZWQ7XG4gIH1cblxuICBwdWJsaWMgZHJhZ3N0YXJ0KGV2ZW50OiBFdmVudCB8IGFueSwgY29ubmVjdG9yOiBGY0Nvbm5lY3Rvcikge1xuICAgIGxldCBzd2FwQ29ubmVjdG9yOiBGY0Nvbm5lY3RvcjtcbiAgICBsZXQgZHJhZ0xhYmVsOiBzdHJpbmc7XG4gICAgbGV0IHByZXZFZGdlOiBGY0VkZ2U7XG4gICAgaWYgKGNvbm5lY3Rvci50eXBlID09PSBGbG93Y2hhcnRDb25zdGFudHMubGVmdENvbm5lY3RvclR5cGUpIHtcbiAgICAgIGZvciAoY29uc3QgZWRnZSBvZiB0aGlzLm1vZGVsLmVkZ2VzKSB7XG4gICAgICAgIGlmIChlZGdlLmRlc3RpbmF0aW9uID09PSBjb25uZWN0b3IuaWQpIHtcbiAgICAgICAgICBzd2FwQ29ubmVjdG9yID0gdGhpcy5tb2RlbFNlcnZpY2UuY29ubmVjdG9ycy5nZXRDb25uZWN0b3IoZWRnZS5zb3VyY2UpO1xuICAgICAgICAgIGRyYWdMYWJlbCA9IGVkZ2UubGFiZWw7XG4gICAgICAgICAgcHJldkVkZ2UgPSBlZGdlO1xuICAgICAgICAgIHRoaXMuYXBwbHlGdW5jdGlvbigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1vZGVsU2VydmljZS5lZGdlcy5kZWxldGUoZWRnZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5lZGdlRHJhZ2dpbmcuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgaWYgKHN3YXBDb25uZWN0b3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5kcmFnZ2VkRWRnZVNvdXJjZSA9IHN3YXBDb25uZWN0b3I7XG4gICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQxID0gdGhpcy5tb2RlbFNlcnZpY2UuY29ubmVjdG9ycy5nZXRDZW50ZXJlZENvb3JkKHN3YXBDb25uZWN0b3IuaWQpO1xuICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ0xhYmVsID0gZHJhZ0xhYmVsO1xuICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcucHJldkVkZ2UgPSBwcmV2RWRnZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kcmFnZ2VkRWRnZVNvdXJjZSA9IGNvbm5lY3RvcjtcbiAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDEgPSB0aGlzLm1vZGVsU2VydmljZS5jb25uZWN0b3JzLmdldENlbnRlcmVkQ29vcmQoY29ubmVjdG9yLmlkKTtcbiAgICB9XG4gICAgY29uc3QgY2FudmFzID0gdGhpcy5tb2RlbFNlcnZpY2UuY2FudmFzSHRtbEVsZW1lbnQ7XG4gICAgaWYgKCFjYW52YXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY2FudmFzIHdoaWxlIGVkZ2VkcmFnZ2luZ1NlcnZpY2UgZm91bmQuJyk7XG4gICAgfVxuICAgIHRoaXMuZHJhZ09mZnNldC54ID0gLWNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5sZWZ0O1xuICAgIHRoaXMuZHJhZ09mZnNldC55ID0gLWNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cbiAgICB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQyID0ge1xuICAgICAgeDogZXZlbnQuY2xpZW50WCArIHRoaXMuZHJhZ09mZnNldC54LFxuICAgICAgeTogZXZlbnQuY2xpZW50WSArIHRoaXMuZHJhZ09mZnNldC55XG4gICAgfTtcbiAgICBjb25zdCBvcmlnaW5hbEV2ZW50OiBFdmVudCB8IGFueSA9IChldmVudCBhcyBhbnkpLm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQ7XG5cbiAgICBvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlci5zZXREYXRhKCdUZXh0JywgJ0p1c3QgdG8gc3VwcG9ydCBmaXJlZm94Jyk7XG4gICAgaWYgKG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyLnNldERyYWdJbWFnZSkge1xuICAgICAgb3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuc2V0RHJhZ0ltYWdlKHRoaXMubW9kZWxTZXJ2aWNlLmdldERyYWdJbWFnZSgpLCAwLCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZXN0aW5hdGlvbkh0bWxFbGVtZW50ID0gZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5vbGREaXNwbGF5U3R5bGUgPSB0aGlzLmRlc3RpbmF0aW9uSHRtbEVsZW1lbnQuc3R5bGUuZGlzcGxheTtcbiAgICAgIHRoaXMuZGVzdGluYXRpb25IdG1sRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgaWYgKHRoaXMuZHJhZ0FuaW1hdGlvbiA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmRyYWdBbmltYXRpb25TaGFkb3cpIHtcbiAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuc2hhZG93RHJhZ1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5kcmFnQW5pbWF0aW9uID09PSBGbG93Y2hhcnRDb25zdGFudHMuZHJhZ0FuaW1hdGlvblNoYWRvdykge1xuICAgICAgaWYgKHRoaXMuZWRnZURyYWdnaW5nLmdFbGVtZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZ0VsZW1lbnQgPSAkKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5zaGFkb3ctc3ZnLWNsYXNzJykpO1xuICAgICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5wYXRoRWxlbWVudCA9ICQoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNoYWRvdy1zdmctY2xhc3MnKSkuZmluZCgncGF0aCcpO1xuICAgICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5jaXJjbGVFbGVtZW50ID0gJChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuc2hhZG93LXN2Zy1jbGFzcycpKS5maW5kKCdjaXJjbGUnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZ0VsZW1lbnQuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5wYXRoRWxlbWVudC5hdHRyKCdkJyxcbiAgICAgICAgdGhpcy5lZGdlRHJhd2luZ1NlcnZpY2UuZ2V0RWRnZURBdHRyaWJ1dGUodGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50MSwgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50MiwgdGhpcy5lZGdlU3R5bGUsIHRoaXMudmVydGljYWxlZGdlZW5hYmxlZCkpO1xuICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuY2lyY2xlRWxlbWVudC5hdHRyKCdjeCcsIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIueCk7XG4gICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5jaXJjbGVFbGVtZW50LmF0dHIoJ2N5JywgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50Mi55KTtcbiAgICB9XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cblxuICBwdWJsaWMgZHJhZ292ZXIoZXZlbnQ6IEV2ZW50IHwgYW55KSB7XG4gICAgaWYgKHRoaXMuZWRnZURyYWdnaW5nLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGlmICghdGhpcy5lZGdlRHJhZ2dpbmcubWFnbmV0QWN0aXZlICYmIHRoaXMuZHJhZ0FuaW1hdGlvbiA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmRyYWdBbmltYXRpb25TaGFkb3cpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdGluYXRpb25IdG1sRWxlbWVudCAhPT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25IdG1sRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gdGhpcy5vbGREaXNwbGF5U3R5bGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lZGdlRHJhZ2dpbmcuc2hhZG93RHJhZ1N0YXJ0ZWQpIHtcbiAgICAgICAgICB0aGlzLmFwcGx5RnVuY3Rpb24oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuc2hhZG93RHJhZ1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIgPSB7XG4gICAgICAgICAgeDogZXZlbnQuY2xpZW50WCArIHRoaXMuZHJhZ09mZnNldC54LFxuICAgICAgICAgIHk6IGV2ZW50LmNsaWVudFkgKyB0aGlzLmRyYWdPZmZzZXQueVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZWRnZURyYWdnaW5nLnBhdGhFbGVtZW50LmF0dHIoJ2QnLFxuICAgICAgICAgIHRoaXMuZWRnZURyYXdpbmdTZXJ2aWNlLmdldEVkZ2VEQXR0cmlidXRlKHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDEsIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIsIHRoaXMuZWRnZVN0eWxlLCB0aGlzLnZlcnRpY2FsZWRnZWVuYWJsZWQpKTtcbiAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuY2lyY2xlRWxlbWVudC5hdHRyKCdjeCcsIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIueCk7XG4gICAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmNpcmNsZUVsZW1lbnQuYXR0cignY3knLCB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQyLnkpO1xuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuZHJhZ0FuaW1hdGlvbiA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmRyYWdBbmltYXRpb25SZXBhaW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFwcGx5RnVuY3Rpb24oKCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmRlc3RpbmF0aW9uSHRtbEVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25IdG1sRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gdGhpcy5vbGREaXNwbGF5U3R5bGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50MiA9IHtcbiAgICAgICAgICAgIHg6IGV2ZW50LmNsaWVudFggKyB0aGlzLmRyYWdPZmZzZXQueCxcbiAgICAgICAgICAgIHk6IGV2ZW50LmNsaWVudFkgKyB0aGlzLmRyYWdPZmZzZXQueVxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBkcmFnb3ZlckNvbm5lY3RvcihldmVudDogRXZlbnQgfCBhbnksIGNvbm5lY3RvcjogRmNDb25uZWN0b3IpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5lZGdlRHJhZ2dpbmcuaXNEcmFnZ2luZykge1xuICAgICAgdGhpcy5kcmFnb3ZlcihldmVudCk7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLm1vZGVsVmFsaWRhdGlvbi52YWxpZGF0ZUVkZ2VzKHRoaXMubW9kZWwuZWRnZXMuY29uY2F0KFt7XG4gICAgICAgICAgc291cmNlOiB0aGlzLmRyYWdnZWRFZGdlU291cmNlLmlkLFxuICAgICAgICAgIGRlc3RpbmF0aW9uOiBjb25uZWN0b3IuaWRcbiAgICAgICAgfV0pLCB0aGlzLm1vZGVsLm5vZGVzKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIE1vZGVsdmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzVmFsaWRFZGdlQ2FsbGJhY2sodGhpcy5kcmFnZ2VkRWRnZVNvdXJjZSwgY29ubmVjdG9yKSkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBkcmFnbGVhdmVNYWduZXQoZXZlbnQ6IEV2ZW50IHwgYW55KSB7XG4gICAgdGhpcy5lZGdlRHJhZ2dpbmcubWFnbmV0QWN0aXZlID0gZmFsc2U7XG4gIH1cblxuICBwdWJsaWMgZHJhZ292ZXJNYWduZXQoZXZlbnQ6IEV2ZW50IHwgYW55LCBjb25uZWN0b3I6IEZjQ29ubmVjdG9yKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuZWRnZURyYWdnaW5nLmlzRHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ292ZXIoZXZlbnQpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5tb2RlbFZhbGlkYXRpb24udmFsaWRhdGVFZGdlcyh0aGlzLm1vZGVsLmVkZ2VzLmNvbmNhdChbe1xuICAgICAgICAgIHNvdXJjZTogdGhpcy5kcmFnZ2VkRWRnZVNvdXJjZS5pZCxcbiAgICAgICAgICBkZXN0aW5hdGlvbjogY29ubmVjdG9yLmlkXG4gICAgICAgIH1dKSwgdGhpcy5tb2RlbC5ub2Rlcyk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBNb2RlbHZhbGlkYXRpb25FcnJvcikge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkRWRnZUNhbGxiYWNrKHRoaXMuZHJhZ2dlZEVkZ2VTb3VyY2UsIGNvbm5lY3RvcikpIHtcbiAgICAgICAgaWYgKHRoaXMuZHJhZ0FuaW1hdGlvbiA9PT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmRyYWdBbmltYXRpb25TaGFkb3cpIHtcblxuICAgICAgICAgIHRoaXMuZWRnZURyYWdnaW5nLm1hZ25ldEFjdGl2ZSA9IHRydWU7XG5cbiAgICAgICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQyID0gdGhpcy5tb2RlbFNlcnZpY2UuY29ubmVjdG9ycy5nZXRDZW50ZXJlZENvb3JkKGNvbm5lY3Rvci5pZCk7XG4gICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcucGF0aEVsZW1lbnQuYXR0cignZCcsXG4gICAgICAgICAgICB0aGlzLmVkZ2VEcmF3aW5nU2VydmljZS5nZXRFZGdlREF0dHJpYnV0ZSh0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQxLCB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnUG9pbnQyLCB0aGlzLmVkZ2VTdHlsZSwgdGhpcy52ZXJ0aWNhbGVkZ2VlbmFibGVkKSk7XG4gICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuY2lyY2xlRWxlbWVudC5hdHRyKCdjeCcsIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIueCk7XG4gICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuY2lyY2xlRWxlbWVudC5hdHRyKCdjeScsIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDIueSk7XG5cbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRyYWdBbmltYXRpb24gPT09IEZsb3djaGFydENvbnN0YW50cy5kcmFnQW5pbWF0aW9uUmVwYWludCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmFwcGx5RnVuY3Rpb24oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50MiA9IHRoaXMubW9kZWxTZXJ2aWNlLmNvbm5lY3RvcnMuZ2V0Q2VudGVyZWRDb29yZChjb25uZWN0b3IuaWQpO1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGRyYWdlbmQoZXZlbnQ6IEV2ZW50IHwgYW55KSB7XG4gICAgaWYgKHRoaXMuZWRnZURyYWdnaW5nLmlzRHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmRyYWdQb2ludDEgPSBudWxsO1xuICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcuZHJhZ1BvaW50MiA9IG51bGw7XG4gICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnTGFiZWwgPSBudWxsO1xuICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdBbmltYXRpb24gPT09IEZsb3djaGFydENvbnN0YW50cy5kcmFnQW5pbWF0aW9uU2hhZG93KSB7XG4gICAgICAgIHRoaXMuZWRnZURyYWdnaW5nLmdFbGVtZW50LmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5lZGdlRHJhZ2dpbmcucHJldkVkZ2UpIHtcbiAgICAgICAgY29uc3QgZWRnZSA9IHRoaXMuZWRnZURyYWdnaW5nLnByZXZFZGdlO1xuICAgICAgICB0aGlzLmVkZ2VEcmFnZ2luZy5wcmV2RWRnZSA9IG51bGw7XG4gICAgICAgIHRoaXMuYXBwbHlGdW5jdGlvbigoKSA9PiB7XG4gICAgICAgICAgdGhpcy5tb2RlbFNlcnZpY2UuZWRnZXMucHV0RWRnZShlZGdlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGRyb3AoZXZlbnQ6IEV2ZW50IHwgYW55LCB0YXJnZXRDb25uZWN0b3I6IEZjQ29ubmVjdG9yKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuZWRnZURyYWdnaW5nLmlzRHJhZ2dpbmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMubW9kZWxWYWxpZGF0aW9uLnZhbGlkYXRlRWRnZXModGhpcy5tb2RlbC5lZGdlcy5jb25jYXQoW3tcbiAgICAgICAgICBzb3VyY2U6IHRoaXMuZHJhZ2dlZEVkZ2VTb3VyY2UuaWQsXG4gICAgICAgICAgZGVzdGluYXRpb246IHRhcmdldENvbm5lY3Rvci5pZFxuICAgICAgICB9XSksIHRoaXMubW9kZWwubm9kZXMpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgTW9kZWx2YWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5pc1ZhbGlkRWRnZUNhbGxiYWNrKHRoaXMuZHJhZ2dlZEVkZ2VTb3VyY2UsIHRhcmdldENvbm5lY3RvcikpIHtcbiAgICAgICAgdGhpcy5lZGdlRHJhZ2dpbmcucHJldkVkZ2UgPSBudWxsO1xuICAgICAgICB0aGlzLm1vZGVsU2VydmljZS5lZGdlcy5fYWRkRWRnZShldmVudCwgdGhpcy5kcmFnZ2VkRWRnZVNvdXJjZSwgdGFyZ2V0Q29ubmVjdG9yLCB0aGlzLmVkZ2VEcmFnZ2luZy5kcmFnTGFiZWwpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVkZ2VEcmFnZ2luZyB7XG4gIGlzRHJhZ2dpbmc6IGJvb2xlYW47XG4gIHNoYWRvd0RyYWdTdGFydGVkOiBib29sZWFuO1xuICBkcmFnUG9pbnQxOiBGY0Nvb3JkcztcbiAgZHJhZ1BvaW50MjogRmNDb29yZHM7XG4gIGRyYWdMYWJlbD86IHN0cmluZztcbiAgcHJldkVkZ2U/OiBGY0VkZ2U7XG4gIG1hZ25ldEFjdGl2ZT86IGJvb2xlYW47XG4gIGdFbGVtZW50PzogSlF1ZXJ5PEVsZW1lbnQ+O1xuICBwYXRoRWxlbWVudD86IEpRdWVyeTxFbGVtZW50PjtcbiAgY2lyY2xlRWxlbWVudD86IEpRdWVyeTxFbGVtZW50Pjtcbn1cbiJdfQ==