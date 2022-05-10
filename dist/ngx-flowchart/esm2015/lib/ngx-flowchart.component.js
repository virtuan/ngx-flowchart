import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, IterableDiffers, NgZone, Output } from '@angular/core';
import { FlowchartConstants } from './ngx-flowchart.models';
import { FcModelService } from './model.service';
import { FcModelValidationService } from './modelvalidation.service';
import { FcNodeDraggingService } from './node-dragging.service';
import { FcEdgeDrawingService } from './edge-drawing.service';
import { FcEdgeDraggingService } from './edge-dragging.service';
import { FcMouseOverService } from './mouseover.service';
import { FcRectangleSelectService } from './rectangleselect.service';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
export class NgxFlowchartComponent {
    constructor(elementRef, differs, modelValidation, edgeDrawingService, cd, zone) {
        this.elementRef = elementRef;
        this.differs = differs;
        this.modelValidation = modelValidation;
        this.edgeDrawingService = edgeDrawingService;
        this.cd = cd;
        this.zone = zone;
        this.modelChanged = new EventEmitter();
        this.fitModelSizeByDefaultValue = true;
        this.flowchartConstants = FlowchartConstants;
        this.nodesDiffer = this.differs.find([]).create((index, item) => {
            return item;
        });
        this.edgesDiffer = this.differs.find([]).create((index, item) => {
            return item;
        });
        this.detectChangesSubject = new Subject();
        this.arrowDefId = 'arrow-' + Math.random();
        this.arrowDefIdSelected = this.arrowDefId + '-selected';
        this.detectChangesSubject
            .pipe(debounceTime(50))
            .subscribe(() => this.cd.detectChanges());
    }
    get canvasClass() {
        return FlowchartConstants.canvasClass;
    }
    get fitModelSizeByDefault() {
        return this.fitModelSizeByDefaultValue;
    }
    set fitModelSizeByDefault(value) {
        this.fitModelSizeByDefaultValue = coerceBooleanProperty(value);
    }
    ngOnInit() {
        if (!this.dropTargetId && this.edgeStyle !== FlowchartConstants.curvedStyle && this.edgeStyle !== FlowchartConstants.lineStyle) {
            throw new Error('edgeStyle not supported.');
        }
        this.nodeHeight = this.nodeHeight || 200;
        this.nodeWidth = this.nodeWidth || 200;
        this.dragAnimation = this.dragAnimation || FlowchartConstants.dragAnimationRepaint;
        this.userCallbacks = this.userCallbacks || {};
        this.automaticResize = this.automaticResize || false;
        for (const key of Object.keys(this.userCallbacks)) {
            const callback = this.userCallbacks[key];
            if (typeof callback !== 'function' && key !== 'nodeCallbacks') {
                throw new Error('All callbacks should be functions.');
            }
        }
        this.userNodeCallbacks = this.userCallbacks.nodeCallbacks;
        const element = $(this.elementRef.nativeElement);
        this.modelService = new FcModelService(this.modelValidation, this.model, this.modelChanged, this.detectChangesSubject, this.selectedObjects, this.userCallbacks.dropNode, this.userCallbacks.createEdge, this.userCallbacks.edgeAdded, this.userCallbacks.nodeRemoved, this.userCallbacks.edgeRemoved, element[0], element[0].querySelector('svg'), this.verticaledgeenabled);
        if (this.dropTargetId) {
            this.modelService.dropTargetId = this.dropTargetId;
        }
        const applyFunction = this.zone.run.bind(this.zone);
        this.nodeDraggingService = new FcNodeDraggingService(this.modelService, applyFunction, this.automaticResize, this.dragAnimation);
        this.edgeDraggingService = new FcEdgeDraggingService(this.modelValidation, this.edgeDrawingService, this.modelService, this.model, this.userCallbacks.isValidEdge || null, applyFunction, this.dragAnimation, this.edgeStyle, this.verticaledgeenabled);
        this.mouseoverService = new FcMouseOverService(applyFunction);
        this.rectangleSelectService = new FcRectangleSelectService(this.modelService, element[0].querySelector('#select-rectangle'), applyFunction);
        this.callbacks = {
            nodeDragstart: this.nodeDraggingService.dragstart.bind(this.nodeDraggingService),
            nodeDragend: this.nodeDraggingService.dragend.bind(this.nodeDraggingService),
            edgeDragstart: this.edgeDraggingService.dragstart.bind(this.edgeDraggingService),
            edgeDragend: this.edgeDraggingService.dragend.bind(this.edgeDraggingService),
            edgeDrop: this.edgeDraggingService.drop.bind(this.edgeDraggingService),
            edgeDragoverConnector: this.edgeDraggingService.dragoverConnector.bind(this.edgeDraggingService),
            edgeDragoverMagnet: this.edgeDraggingService.dragoverMagnet.bind(this.edgeDraggingService),
            edgeDragleaveMagnet: this.edgeDraggingService.dragleaveMagnet.bind(this.edgeDraggingService),
            nodeMouseOver: this.mouseoverService.nodeMouseOver.bind(this.mouseoverService),
            nodeMouseOut: this.mouseoverService.nodeMouseOut.bind(this.mouseoverService),
            connectorMouseEnter: this.mouseoverService.connectorMouseEnter.bind(this.mouseoverService),
            connectorMouseLeave: this.mouseoverService.connectorMouseLeave.bind(this.mouseoverService),
            nodeClicked: (event, node) => {
                this.modelService.nodes.handleClicked(node, event.ctrlKey);
                event.stopPropagation();
                event.preventDefault();
            }
        };
        this.adjustCanvasSize(this.fitModelSizeByDefault);
    }
    ngDoCheck() {
        if (this.model) {
            const nodesChange = this.nodesDiffer.diff(this.model.nodes);
            const edgesChange = this.edgesDiffer.diff(this.model.edges);
            let nodesChanged = false;
            let edgesChanged = false;
            if (nodesChange !== null) {
                nodesChange.forEachAddedItem(() => {
                    nodesChanged = true;
                });
                nodesChange.forEachRemovedItem(() => {
                    nodesChanged = true;
                });
            }
            if (edgesChange !== null) {
                edgesChange.forEachAddedItem(() => {
                    edgesChanged = true;
                });
                edgesChange.forEachRemovedItem(() => {
                    edgesChanged = true;
                });
            }
            if (nodesChanged) {
                this.adjustCanvasSize(this.fitModelSizeByDefault);
            }
            if (nodesChanged || edgesChanged) {
                this.detectChangesSubject.next();
            }
        }
    }
    getEdgeDAttribute(edge) {
        return this.edgeDrawingService.getEdgeDAttribute(this.modelService.edges.sourceCoord(edge), this.modelService.edges.destCoord(edge), this.edgeStyle, this.verticaledgeenabled);
    }
    adjustCanvasSize(fit) {
        let maxX = 0;
        let maxY = 0;
        const element = $(this.elementRef.nativeElement);
        this.model.nodes.forEach((node) => {
            maxX = Math.max(node.x + this.nodeWidth, maxX);
            maxY = Math.max(node.y + this.nodeHeight, maxY);
        });
        let width;
        let height;
        if (fit) {
            width = maxX;
            height = maxY;
        }
        else {
            width = Math.max(maxX, element.prop('offsetWidth'));
            height = Math.max(maxY, element.prop('offsetHeight'));
        }
        element.css('width', width + 'px');
        element.css('height', height + 'px');
    }
    canvasClick(event) { }
    edgeMouseDown(event, edge) {
        event.stopPropagation();
    }
    edgeClick(event, edge) {
        this.modelService.edges.handleEdgeMouseClick(edge, event.ctrlKey);
        event.stopPropagation();
        event.preventDefault();
    }
    edgeRemove(event, edge) {
        this.modelService.edges.delete(edge);
        event.stopPropagation();
        event.preventDefault();
    }
    edgeEdit(event, edge) {
        if (this.userCallbacks.edgeEdit) {
            this.userCallbacks.edgeEdit(event, edge);
        }
    }
    edgeDoubleClick(event, edge) {
        if (this.userCallbacks.edgeDoubleClick) {
            this.userCallbacks.edgeDoubleClick(event, edge);
        }
    }
    edgeMouseOver(event, edge) {
        if (this.userCallbacks.edgeMouseOver) {
            this.userCallbacks.edgeMouseOver(event, edge);
        }
    }
    edgeMouseEnter(event, edge) {
        this.mouseoverService.edgeMouseEnter(event, edge);
    }
    edgeMouseLeave(event, edge) {
        this.mouseoverService.edgeMouseLeave(event, edge);
    }
    dragover(event) {
        this.nodeDraggingService.dragover(event);
        this.edgeDraggingService.dragover(event);
    }
    drop(event) {
        if (event.preventDefault) {
            event.preventDefault();
        }
        if (event.stopPropagation) {
            event.stopPropagation();
        }
        this.nodeDraggingService.drop(event);
    }
    mousedown(event) {
        this.rectangleSelectService.mousedown(event);
    }
    mousemove(event) {
        this.rectangleSelectService.mousemove(event);
    }
    mouseup(event) {
        this.rectangleSelectService.mouseup(event);
    }
}
NgxFlowchartComponent.decorators = [
    { type: Component, args: [{
                selector: 'fc-canvas',
                template: "<div (click)=\"canvasClick($event)\" class=\"fc-canvas-container\">\n  <svg class=\"fc-canvas-svg\">\n    <defs>\n      <marker class=\"fc-arrow-marker\" [attr.id]=\"arrowDefId\" markerWidth=\"5\" markerHeight=\"5\" viewBox=\"-6 -6 12 12\" refX=\"10\" refY=\"0\" markerUnits=\"strokeWidth\" orient=\"auto\">\n        <polygon points=\"-2,0 -5,5 5,0 -5,-5\" stroke=\"gray\" fill=\"gray\" stroke-width=\"1px\"/>\n      </marker>\n      <marker class=\"fc-arrow-marker-selected\" [attr.id]=\"arrowDefIdSelected\" markerWidth=\"5\" markerHeight=\"5\" viewBox=\"-6 -6 12 12\" refX=\"10\" refY=\"0\" markerUnits=\"strokeWidth\" orient=\"auto\">\n        <polygon points=\"-2,0 -5,5 5,0 -5,-5\" stroke=\"red\" fill=\"red\" stroke-width=\"1px\"/>\n      </marker>\n    </defs>\n    <g *ngFor=\"let edge of model.edges; let $index = index\">\n      <path\n        [attr.id]=\"'fc-edge-path-'+$index\"\n        (mousedown)=\"edgeMouseDown($event, edge)\"\n        (click)=\"edgeClick($event, edge)\"\n        (dblclick)=\"edgeDoubleClick($event, edge)\"\n        (mouseover)=\"edgeMouseOver($event, edge)\"\n        (mouseenter)=\"edgeMouseEnter($event, edge)\"\n        (mouseleave)=\"edgeMouseLeave($event, edge)\"\n        [attr.class]=\"(modelService.edges.isSelected(edge) && flowchartConstants.selectedClass + ' ' + flowchartConstants.edgeClass) ||\n                      edge === mouseoverService.mouseoverscope.edge && flowchartConstants.hoverClass + ' ' + flowchartConstants.edgeClass ||\n                      edge.active && flowchartConstants.activeClass + ' ' + flowchartConstants.edgeClass ||\n                      flowchartConstants.edgeClass\"\n        [attr.d]=\"getEdgeDAttribute(edge)\"\n        [attr.marker-end]=\"'url(#' + (modelService.edges.isSelected(edge) ? arrowDefIdSelected : arrowDefId) + ')'\">\n      </path>\n    </g>\n    <g *ngIf=\"dragAnimation === flowchartConstants.dragAnimationRepaint && edgeDraggingService.edgeDragging.isDragging\">\n      <path [attr.class]=\"flowchartConstants.edgeClass + ' ' + flowchartConstants.draggingClass\"\n            [attr.d]=\"edgeDrawingService.getEdgeDAttribute(edgeDraggingService.edgeDragging.dragPoint1, edgeDraggingService.edgeDragging.dragPoint2, edgeStyle, verticaledgeenabled)\"></path>\n      <circle class=\"edge-endpoint\" r=\"4\"\n              [attr.cx]=\"edgeDraggingService.edgeDragging.dragPoint2.x\"\n              [attr.cy]=\"edgeDraggingService.edgeDragging.dragPoint2.y\">\n      </circle>\n    </g>\n    <g *ngIf=\"dragAnimation === flowchartConstants.dragAnimationShadow\"\n       class=\"shadow-svg-class {{ flowchartConstants.edgeClass }} {{ flowchartConstants.draggingClass }}\"\n       style=\"display:none\">\n      <path d=\"\"></path>\n      <circle class=\"edge-endpoint\" r=\"4\"></circle>\n    </g>\n  </svg>\n  <ng-container *ngFor=\"let node of model.nodes\">\n    <fc-node\n         [selected]=\"modelService.nodes.isSelected(node)\"\n         [edit]=\"modelService.nodes.isEdit(node)\"\n         [underMouse]=\"node === mouseoverService.mouseoverscope.node\"\n         [node]=\"node\"\n         [mouseOverConnector]=\"mouseoverService.mouseoverscope.connector\"\n         [modelservice]=\"modelService\"\n         [dragging]=\"nodeDraggingService.isDraggingNode(node)\"\n         [callbacks]=\"callbacks\"\n         [userNodeCallbacks]=\"userNodeCallbacks\"\n         [verticaledgeenabled]=\"verticaledgeenabled\">\n    </fc-node>\n  </ng-container>\n  <div *ngIf=\"dragAnimation === flowchartConstants.dragAnimationRepaint && edgeDraggingService.edgeDragging.isDragging\"\n       [attr.class]=\"'fc-noselect ' + flowchartConstants.edgeLabelClass\"\n       [ngStyle]=\"{\n          top: (edgeDrawingService.getEdgeCenter(edgeDraggingService.edgeDragging.dragPoint1, edgeDraggingService.edgeDragging.dragPoint2).y)+'px',\n          left: (edgeDrawingService.getEdgeCenter(edgeDraggingService.edgeDragging.dragPoint1, edgeDraggingService.edgeDragging.dragPoint2).x)+'px'\n       }\">\n    <div class=\"fc-edge-label-text\">\n      <span [attr.id]=\"'fc-edge-label-dragging'\" *ngIf=\"edgeDraggingService.edgeDragging.dragLabel\">{{edgeDraggingService.edgeDragging.dragLabel}}</span>\n    </div>\n  </div>\n  <div\n    (mousedown)=\"edgeMouseDown($event, edge)\"\n    (click)=\"edgeClick($event, edge)\"\n    (dblclick)=\"edgeDoubleClick($event, edge)\"\n    (mouseover)=\"edgeMouseOver($event, edge)\"\n    (mouseenter)=\"edgeMouseEnter($event, edge)\"\n    (mouseleave)=\"edgeMouseLeave($event, edge)\"\n    [attr.class]=\"'fc-noselect ' + ((modelService.edges.isEdit(edge) && flowchartConstants.editClass + ' ' + flowchartConstants.edgeLabelClass) ||\n                      (modelService.edges.isSelected(edge) && flowchartConstants.selectedClass + ' ' + flowchartConstants.edgeLabelClass) ||\n                      edge === mouseoverService.mouseoverscope.edge && flowchartConstants.hoverClass + ' ' + flowchartConstants.edgeLabelClass ||\n                      edge.active && flowchartConstants.activeClass + ' ' + flowchartConstants.edgeLabelClass ||\n                      flowchartConstants.edgeLabelClass)\"\n    [ngStyle]=\"{\n      top: (edgeDrawingService.getEdgeCenter(modelService.edges.sourceCoord(edge), modelService.edges.destCoord(edge)).y)+'px',\n      left: (edgeDrawingService.getEdgeCenter(modelService.edges.sourceCoord(edge), modelService.edges.destCoord(edge)).x)+'px'\n    }\"\n    *ngFor=\"let edge of model.edges; let $index = index\">\n    <div class=\"fc-edge-label-text\">\n      <div *ngIf=\"modelService.isEditable()\" class=\"fc-noselect fc-nodeedit\" (click)=\"edgeEdit($event, edge)\">\n        <i class=\"fa fa-pencil\" aria-hidden=\"true\"></i>\n      </div>\n      <div *ngIf=\"modelService.isEditable()\" class=\"fc-noselect fc-nodedelete\" (click)=\"edgeRemove($event, edge)\">\n        &times;\n      </div>\n      <span [attr.id]=\"'fc-edge-label-'+$index\" *ngIf=\"edge.label\">{{edge.label}}</span>\n    </div>\n  </div>\n  <div id=\"select-rectangle\" class=\"fc-select-rectangle\" hidden>\n  </div>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: [":host{-moz-user-select:none;-ms-user-select:none;-webkit-touch-callout:none;-webkit-user-select:none;background-color:transparent;background-image:linear-gradient(90deg,rgba(0,0,0,.1) 1px,transparent 0),linear-gradient(180deg,rgba(0,0,0,.1) 1px,transparent 0);background-size:25px 25px;min-height:100%;min-width:100%;user-select:none}:host,:host .fc-canvas-container,:host .fc-canvas-container svg.fc-canvas-svg{display:block;height:100%;position:relative;width:100%}:host .fc-edge{fill:transparent;stroke:grey;stroke-width:4;transition:stroke-width .2s}:host .fc-edge.fc-hover{fill:transparent;stroke:grey;stroke-width:6}:host .fc-edge.fc-selected{fill:transparent;stroke:red;stroke-width:4}:host .fc-edge.fc-active{-webkit-animation:dash 3s linear infinite;animation:dash 3s linear infinite;stroke-dasharray:20}:host .fc-edge.fc-dragging{pointer-events:none}:host .fc-arrow-marker polygon{fill:grey;stroke:grey}:host .fc-arrow-marker-selected polygon{fill:red;stroke:red}:host .edge-endpoint{fill:grey}:host .fc-noselect{-moz-user-select:none;-ms-user-select:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}:host .fc-edge-label{margin:0 auto;opacity:.8;position:absolute;transform-origin:bottom left;transition:transform .2s}:host .fc-edge-label .fc-edge-label-text{font-size:16px;position:absolute;text-align:center;transform:translate(-50%,-50%);white-space:nowrap}:host .fc-edge-label .fc-edge-label-text span{background-color:#fff;border:solid #ff3d00;border-radius:10px;color:#ff3d00;cursor:default;padding:3px 5px}:host .fc-edge-label .fc-nodeedit{right:14px;top:-30px}:host .fc-edge-label .fc-nodedelete{right:-13px;top:-30px}:host .fc-edge-label.fc-hover{transform:scale(1.25)}:host .fc-edge-label.fc-edit .fc-edge-label-text span,:host .fc-edge-label.fc-selected .fc-edge-label-text span{background-color:red;border:solid red;color:#fff;font-weight:600}:host .fc-select-rectangle{background:rgba(20,125,255,.1);border:2px dashed #5262ff;position:absolute;z-index:2}@-webkit-keyframes dash{0%{stroke-dashoffset:500}}@keyframes dash{0%{stroke-dashoffset:500}}:host ::ng-deep .fc-nodeedit{display:none;font-size:15px}:host ::ng-deep .fc-nodedelete{display:none;font-size:18px}:host ::ng-deep .fc-edit .fc-nodedelete,:host ::ng-deep .fc-edit .fc-nodeedit{background:#494949;border:2px solid #eee;border-radius:50%;color:#fff;cursor:pointer;display:block;font-weight:600;height:20px;line-height:20px;padding-top:2px;position:absolute;text-align:center;vertical-align:bottom;width:22px}:host ::ng-deep .fc-edit .fc-nodeedit{right:16px;top:-24px}:host ::ng-deep .fc-edit .fc-nodedelete{right:-13px;top:-24px}"]
            },] }
];
NgxFlowchartComponent.ctorParameters = () => [
    { type: ElementRef },
    { type: IterableDiffers },
    { type: FcModelValidationService },
    { type: FcEdgeDrawingService },
    { type: ChangeDetectorRef },
    { type: NgZone }
];
NgxFlowchartComponent.propDecorators = {
    canvasClass: [{ type: HostBinding, args: ['attr.class',] }],
    model: [{ type: Input }],
    selectedObjects: [{ type: Input }],
    edgeStyle: [{ type: Input }],
    verticaledgeenabled: [{ type: Input }],
    userCallbacks: [{ type: Input }],
    automaticResize: [{ type: Input }],
    dragAnimation: [{ type: Input }],
    nodeWidth: [{ type: Input }],
    nodeHeight: [{ type: Input }],
    dropTargetId: [{ type: Input }],
    modelChanged: [{ type: Output }],
    fitModelSizeByDefault: [{ type: Input }],
    dragover: [{ type: HostListener, args: ['dragover', ['$event'],] }],
    drop: [{ type: HostListener, args: ['drop', ['$event'],] }],
    mousedown: [{ type: HostListener, args: ['mousedown', ['$event'],] }],
    mousemove: [{ type: HostListener, args: ['mousemove', ['$event'],] }],
    mouseup: [{ type: HostListener, args: ['mouseup', ['$event'],] }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmd4LWZsb3djaGFydC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtZmxvd2NoYXJ0L3NyYy9saWIvbmd4LWZsb3djaGFydC5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBS0EsT0FBTyxFQUNMLHVCQUF1QixFQUN2QixpQkFBaUIsRUFDakIsU0FBUyxFQUNULFVBQVUsRUFDVixZQUFZLEVBQ1osV0FBVyxFQUNYLFlBQVksRUFDWixLQUFLLEVBQ0wsZUFBZSxFQUNmLE1BQU0sRUFDTixNQUFNLEVBQ1AsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUF3QyxrQkFBa0IsRUFBb0MsTUFBTSx3QkFBd0IsQ0FBQztBQUNwSSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDakQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDckUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDaEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDOUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDaEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDekQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDckUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUMvQixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFROUMsTUFBTSxPQUFPLHFCQUFxQjtJQTBFaEMsWUFBb0IsVUFBbUMsRUFDbkMsT0FBd0IsRUFDeEIsZUFBeUMsRUFDMUMsa0JBQXdDLEVBQ3ZDLEVBQXFCLEVB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QkMsVUFBVTtZQUtWLGVBQWU7WUFNUix3QkFBd0I7WUFFeEIsb0JBQW9CO1lBZjNCLGlCQUFpQjtZQVFqQixNQUFNOzs7MEJBdUJMLFdBQVcsU0FBQyxZQUFZO29CQUt4QixLQUFLOzhCQUdMLEtBQUs7d0JBR0wsS0FBSztrQ0FHTCxLQUFLOzRCQUdMLEtBQUs7OEJBR0wsS0FBSzs0QkFHTCxLQUFLO3dCQUdMLEtBQUs7eUJBR0wsS0FBSzsyQkFHTCxLQUFLOzJCQUdMLE1BQU07b0NBT04sS0FBSzt1QkFrTkwsWUFBWSxTQUFDLFVBQVUsRUFBRSxDQUFDLFFBQVEsQ0FBQzttQkFNbkMsWUFBWSxTQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQzt3QkFXL0IsWUFBWSxTQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQzt3QkFLcEMsWUFBWSxTQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQztzQkFLcEMsWUFBWSxTQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIERvQ2hlY2ssXG4gIEl0ZXJhYmxlRGlmZmVyLFxuICBPbkluaXRcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQge1xuICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gIENvbXBvbmVudCxcbiAgRWxlbWVudFJlZixcbiAgRXZlbnRFbWl0dGVyLFxuICBIb3N0QmluZGluZyxcbiAgSG9zdExpc3RlbmVyLFxuICBJbnB1dCxcbiAgSXRlcmFibGVEaWZmZXJzLFxuICBOZ1pvbmUsXG4gIE91dHB1dFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEZjQ2FsbGJhY2tzLCBGY0VkZ2UsIEZjTW9kZWwsIEZjTm9kZSwgRmxvd2NoYXJ0Q29uc3RhbnRzLCBVc2VyQ2FsbGJhY2tzLCBVc2VyTm9kZUNhbGxiYWNrcyB9IGZyb20gJy4vbmd4LWZsb3djaGFydC5tb2RlbHMnO1xuaW1wb3J0IHsgRmNNb2RlbFNlcnZpY2UgfSBmcm9tICcuL21vZGVsLnNlcnZpY2UnO1xuaW1wb3J0IHsgRmNNb2RlbFZhbGlkYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9tb2RlbHZhbGlkYXRpb24uc2VydmljZSc7XG5pbXBvcnQgeyBGY05vZGVEcmFnZ2luZ1NlcnZpY2UgfSBmcm9tICcuL25vZGUtZHJhZ2dpbmcuc2VydmljZSc7XG5pbXBvcnQgeyBGY0VkZ2VEcmF3aW5nU2VydmljZSB9IGZyb20gJy4vZWRnZS1kcmF3aW5nLnNlcnZpY2UnO1xuaW1wb3J0IHsgRmNFZGdlRHJhZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi9lZGdlLWRyYWdnaW5nLnNlcnZpY2UnO1xuaW1wb3J0IHsgRmNNb3VzZU92ZXJTZXJ2aWNlIH0gZnJvbSAnLi9tb3VzZW92ZXIuc2VydmljZSc7XG5pbXBvcnQgeyBGY1JlY3RhbmdsZVNlbGVjdFNlcnZpY2UgfSBmcm9tICcuL3JlY3RhbmdsZXNlbGVjdC5zZXJ2aWNlJztcbmltcG9ydCB7IGNvZXJjZUJvb2xlYW5Qcm9wZXJ0eSB9IGZyb20gJ0Bhbmd1bGFyL2Nkay9jb2VyY2lvbic7XG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBkZWJvdW5jZVRpbWUgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2ZjLWNhbnZhcycsXG4gIHRlbXBsYXRlVXJsOiAnLi9uZ3gtZmxvd2NoYXJ0LmNvbXBvbmVudC5odG1sJyxcbiAgc3R5bGVVcmxzOiBbJy4vbmd4LWZsb3djaGFydC5jb21wb25lbnQuc2NzcyddLFxuICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaFxufSlcbmV4cG9ydCBjbGFzcyBOZ3hGbG93Y2hhcnRDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIERvQ2hlY2sge1xuXG4gIEBIb3N0QmluZGluZygnYXR0ci5jbGFzcycpXG4gIGdldCBjYW52YXNDbGFzcygpOiBzdHJpbmcge1xuICAgIHJldHVybiBGbG93Y2hhcnRDb25zdGFudHMuY2FudmFzQ2xhc3M7XG4gIH1cblxuICBASW5wdXQoKVxuICBtb2RlbDogRmNNb2RlbDtcblxuICBASW5wdXQoKVxuICBzZWxlY3RlZE9iamVjdHM6IGFueVtdO1xuXG4gIEBJbnB1dCgpXG4gIGVkZ2VTdHlsZTogc3RyaW5nO1xuXG4gIEBJbnB1dCgpXG4gIHZlcnRpY2FsZWRnZWVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgQElucHV0KClcbiAgdXNlckNhbGxiYWNrczogVXNlckNhbGxiYWNrcztcblxuICBASW5wdXQoKVxuICBhdXRvbWF0aWNSZXNpemU6IGJvb2xlYW47XG5cbiAgQElucHV0KClcbiAgZHJhZ0FuaW1hdGlvbjogc3RyaW5nO1xuXG4gIEBJbnB1dCgpXG4gIG5vZGVXaWR0aDogbnVtYmVyO1xuXG4gIEBJbnB1dCgpXG4gIG5vZGVIZWlnaHQ6IG51bWJlcjtcblxuICBASW5wdXQoKVxuICBkcm9wVGFyZ2V0SWQ6IHN0cmluZztcblxuICBAT3V0cHV0KClcbiAgbW9kZWxDaGFuZ2VkID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuXG4gIHByaXZhdGUgZml0TW9kZWxTaXplQnlEZWZhdWx0VmFsdWUgPSB0cnVlO1xuICBnZXQgZml0TW9kZWxTaXplQnlEZWZhdWx0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmZpdE1vZGVsU2l6ZUJ5RGVmYXVsdFZhbHVlO1xuICB9XG4gIEBJbnB1dCgpXG4gIHNldCBmaXRNb2RlbFNpemVCeURlZmF1bHQodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLmZpdE1vZGVsU2l6ZUJ5RGVmYXVsdFZhbHVlID0gY29lcmNlQm9vbGVhblByb3BlcnR5KHZhbHVlKTtcbiAgfVxuXG4gIGNhbGxiYWNrczogRmNDYWxsYmFja3M7XG5cbiAgdXNlck5vZGVDYWxsYmFja3M6IFVzZXJOb2RlQ2FsbGJhY2tzO1xuXG4gIG1vZGVsU2VydmljZTogRmNNb2RlbFNlcnZpY2U7XG4gIG5vZGVEcmFnZ2luZ1NlcnZpY2U6IEZjTm9kZURyYWdnaW5nU2VydmljZTtcbiAgZWRnZURyYWdnaW5nU2VydmljZTogRmNFZGdlRHJhZ2dpbmdTZXJ2aWNlO1xuICBtb3VzZW92ZXJTZXJ2aWNlOiBGY01vdXNlT3ZlclNlcnZpY2U7XG4gIHJlY3RhbmdsZVNlbGVjdFNlcnZpY2U6IEZjUmVjdGFuZ2xlU2VsZWN0U2VydmljZTtcblxuICBhcnJvd0RlZklkOiBzdHJpbmc7XG4gIGFycm93RGVmSWRTZWxlY3RlZDogc3RyaW5nO1xuXG4gIGZsb3djaGFydENvbnN0YW50cyA9IEZsb3djaGFydENvbnN0YW50cztcblxuICBwcml2YXRlIG5vZGVzRGlmZmVyOiBJdGVyYWJsZURpZmZlcjxGY05vZGU+ID0gdGhpcy5kaWZmZXJzLmZpbmQoW10pLmNyZWF0ZTxGY05vZGU+KChpbmRleCwgaXRlbSkgPT4ge1xuICAgIHJldHVybiBpdGVtO1xuICB9KTtcblxuICBwcml2YXRlIGVkZ2VzRGlmZmVyOiBJdGVyYWJsZURpZmZlcjxGY0VkZ2U+ID0gdGhpcy5kaWZmZXJzLmZpbmQoW10pLmNyZWF0ZTxGY0VkZ2U+KChpbmRleCwgaXRlbSkgPT4ge1xuICAgIHJldHVybiBpdGVtO1xuICB9KTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGRldGVjdENoYW5nZXNTdWJqZWN0ID0gbmV3IFN1YmplY3Q8YW55PigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZWxlbWVudFJlZjogRWxlbWVudFJlZjxIVE1MRWxlbWVudD4sXG4gICAgICAgICAgICAgIHByaXZhdGUgZGlmZmVyczogSXRlcmFibGVEaWZmZXJzLFxuICAgICAgICAgICAgICBwcml2YXRlIG1vZGVsVmFsaWRhdGlvbjogRmNNb2RlbFZhbGlkYXRpb25TZXJ2aWNlLFxuICAgICAgICAgICAgICBwdWJsaWMgZWRnZURyYXdpbmdTZXJ2aWNlOiBGY0VkZ2VEcmF3aW5nU2VydmljZSxcbiAgICAgICAgICAgICAgcHJpdmF0ZSBjZDogQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gICAgICAgICAgICAgIHByaXZhdGUgem9uZTogTmdab25lKSB7XG4gICAgdGhpcy5hcnJvd0RlZklkID0gJ2Fycm93LScgKyBNYXRoLnJhbmRvbSgpO1xuICAgIHRoaXMuYXJyb3dEZWZJZFNlbGVjdGVkID0gdGhpcy5hcnJvd0RlZklkICsgJy1zZWxlY3RlZCc7XG4gICAgdGhpcy5kZXRlY3RDaGFuZ2VzU3ViamVjdFxuICAgICAgLnBpcGUoZGVib3VuY2VUaW1lKDUwKSlcbiAgICAgIC5zdWJzY3JpYmUoKCkgPT4gdGhpcy5jZC5kZXRlY3RDaGFuZ2VzKCkpO1xuICB9XG5cbiAgbmdPbkluaXQoKSB7XG4gICAgaWYgKCF0aGlzLmRyb3BUYXJnZXRJZCAmJiB0aGlzLmVkZ2VTdHlsZSAhPT0gRmxvd2NoYXJ0Q29uc3RhbnRzLmN1cnZlZFN0eWxlICYmIHRoaXMuZWRnZVN0eWxlICE9PSBGbG93Y2hhcnRDb25zdGFudHMubGluZVN0eWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2VkZ2VTdHlsZSBub3Qgc3VwcG9ydGVkLicpO1xuICAgIH1cbiAgICB0aGlzLm5vZGVIZWlnaHQgPSB0aGlzLm5vZGVIZWlnaHQgfHwgMjAwO1xuICAgIHRoaXMubm9kZVdpZHRoID0gdGhpcy5ub2RlV2lkdGggfHwgMjAwO1xuICAgIHRoaXMuZHJhZ0FuaW1hdGlvbiA9IHRoaXMuZHJhZ0FuaW1hdGlvbiB8fCBGbG93Y2hhcnRDb25zdGFudHMuZHJhZ0FuaW1hdGlvblJlcGFpbnQ7XG4gICAgdGhpcy51c2VyQ2FsbGJhY2tzID0gdGhpcy51c2VyQ2FsbGJhY2tzIHx8IHt9O1xuICAgIHRoaXMuYXV0b21hdGljUmVzaXplID0gdGhpcy5hdXRvbWF0aWNSZXNpemUgfHwgZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh0aGlzLnVzZXJDYWxsYmFja3MpKSB7XG4gICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMudXNlckNhbGxiYWNrc1trZXldO1xuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJyAmJiBrZXkgIT09ICdub2RlQ2FsbGJhY2tzJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FsbCBjYWxsYmFja3Mgc2hvdWxkIGJlIGZ1bmN0aW9ucy4nKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnVzZXJOb2RlQ2FsbGJhY2tzID0gdGhpcy51c2VyQ2FsbGJhY2tzLm5vZGVDYWxsYmFja3M7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gJCh0aGlzLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCk7XG5cbiAgICB0aGlzLm1vZGVsU2VydmljZSA9IG5ldyBGY01vZGVsU2VydmljZSh0aGlzLm1vZGVsVmFsaWRhdGlvbiwgdGhpcy5tb2RlbCwgdGhpcy5tb2RlbENoYW5nZWQsXG4gICAgICB0aGlzLmRldGVjdENoYW5nZXNTdWJqZWN0LCB0aGlzLnNlbGVjdGVkT2JqZWN0cyxcbiAgICAgIHRoaXMudXNlckNhbGxiYWNrcy5kcm9wTm9kZSwgdGhpcy51c2VyQ2FsbGJhY2tzLmNyZWF0ZUVkZ2UsIHRoaXMudXNlckNhbGxiYWNrcy5lZGdlQWRkZWQsIHRoaXMudXNlckNhbGxiYWNrcy5ub2RlUmVtb3ZlZCxcbiAgICAgIHRoaXMudXNlckNhbGxiYWNrcy5lZGdlUmVtb3ZlZCwgZWxlbWVudFswXSwgZWxlbWVudFswXS5xdWVyeVNlbGVjdG9yKCdzdmcnKSwgdGhpcy52ZXJ0aWNhbGVkZ2VlbmFibGVkKTtcblxuICAgIGlmICh0aGlzLmRyb3BUYXJnZXRJZCkge1xuICAgICAgdGhpcy5tb2RlbFNlcnZpY2UuZHJvcFRhcmdldElkID0gdGhpcy5kcm9wVGFyZ2V0SWQ7XG4gICAgfVxuXG4gICAgY29uc3QgYXBwbHlGdW5jdGlvbiA9IHRoaXMuem9uZS5ydW4uYmluZCh0aGlzLnpvbmUpO1xuXG4gICAgdGhpcy5ub2RlRHJhZ2dpbmdTZXJ2aWNlID0gbmV3IEZjTm9kZURyYWdnaW5nU2VydmljZSh0aGlzLm1vZGVsU2VydmljZSwgYXBwbHlGdW5jdGlvbixcbiAgICAgICAgICB0aGlzLmF1dG9tYXRpY1Jlc2l6ZSwgdGhpcy5kcmFnQW5pbWF0aW9uKTtcblxuICAgIHRoaXMuZWRnZURyYWdnaW5nU2VydmljZSA9IG5ldyBGY0VkZ2VEcmFnZ2luZ1NlcnZpY2UodGhpcy5tb2RlbFZhbGlkYXRpb24sIHRoaXMuZWRnZURyYXdpbmdTZXJ2aWNlLCB0aGlzLm1vZGVsU2VydmljZSxcbiAgICAgIHRoaXMubW9kZWwsIHRoaXMudXNlckNhbGxiYWNrcy5pc1ZhbGlkRWRnZSB8fCBudWxsLCBhcHBseUZ1bmN0aW9uLFxuICAgICAgdGhpcy5kcmFnQW5pbWF0aW9uLCB0aGlzLmVkZ2VTdHlsZSwgdGhpcy52ZXJ0aWNhbGVkZ2VlbmFibGVkKTtcblxuICAgIHRoaXMubW91c2VvdmVyU2VydmljZSA9IG5ldyBGY01vdXNlT3ZlclNlcnZpY2UoYXBwbHlGdW5jdGlvbik7XG5cbiAgICB0aGlzLnJlY3RhbmdsZVNlbGVjdFNlcnZpY2UgPSBuZXcgRmNSZWN0YW5nbGVTZWxlY3RTZXJ2aWNlKHRoaXMubW9kZWxTZXJ2aWNlLFxuICAgICAgZWxlbWVudFswXS5xdWVyeVNlbGVjdG9yKCcjc2VsZWN0LXJlY3RhbmdsZScpLCBhcHBseUZ1bmN0aW9uKTtcblxuICAgIHRoaXMuY2FsbGJhY2tzID0ge1xuICAgICAgbm9kZURyYWdzdGFydDogdGhpcy5ub2RlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdzdGFydC5iaW5kKHRoaXMubm9kZURyYWdnaW5nU2VydmljZSksXG4gICAgICBub2RlRHJhZ2VuZDogdGhpcy5ub2RlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdlbmQuYmluZCh0aGlzLm5vZGVEcmFnZ2luZ1NlcnZpY2UpLFxuICAgICAgZWRnZURyYWdzdGFydDogdGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdzdGFydC5iaW5kKHRoaXMuZWRnZURyYWdnaW5nU2VydmljZSksXG4gICAgICBlZGdlRHJhZ2VuZDogdGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdlbmQuYmluZCh0aGlzLmVkZ2VEcmFnZ2luZ1NlcnZpY2UpLFxuICAgICAgZWRnZURyb3A6IHRoaXMuZWRnZURyYWdnaW5nU2VydmljZS5kcm9wLmJpbmQodGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlKSxcbiAgICAgIGVkZ2VEcmFnb3ZlckNvbm5lY3RvcjogdGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdvdmVyQ29ubmVjdG9yLmJpbmQodGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlKSxcbiAgICAgIGVkZ2VEcmFnb3Zlck1hZ25ldDogdGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdvdmVyTWFnbmV0LmJpbmQodGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlKSxcbiAgICAgIGVkZ2VEcmFnbGVhdmVNYWduZXQ6IHRoaXMuZWRnZURyYWdnaW5nU2VydmljZS5kcmFnbGVhdmVNYWduZXQuYmluZCh0aGlzLmVkZ2VEcmFnZ2luZ1NlcnZpY2UpLFxuICAgICAgbm9kZU1vdXNlT3ZlcjogdGhpcy5tb3VzZW92ZXJTZXJ2aWNlLm5vZGVNb3VzZU92ZXIuYmluZCh0aGlzLm1vdXNlb3ZlclNlcnZpY2UpLFxuICAgICAgbm9kZU1vdXNlT3V0OiB0aGlzLm1vdXNlb3ZlclNlcnZpY2Uubm9kZU1vdXNlT3V0LmJpbmQodGhpcy5tb3VzZW92ZXJTZXJ2aWNlKSxcbiAgICAgIGNvbm5lY3Rvck1vdXNlRW50ZXI6IHRoaXMubW91c2VvdmVyU2VydmljZS5jb25uZWN0b3JNb3VzZUVudGVyLmJpbmQodGhpcy5tb3VzZW92ZXJTZXJ2aWNlKSxcbiAgICAgIGNvbm5lY3Rvck1vdXNlTGVhdmU6IHRoaXMubW91c2VvdmVyU2VydmljZS5jb25uZWN0b3JNb3VzZUxlYXZlLmJpbmQodGhpcy5tb3VzZW92ZXJTZXJ2aWNlKSxcbiAgICAgIG5vZGVDbGlja2VkOiAoZXZlbnQsIG5vZGUpID0+IHtcbiAgICAgICAgdGhpcy5tb2RlbFNlcnZpY2Uubm9kZXMuaGFuZGxlQ2xpY2tlZChub2RlLCBldmVudC5jdHJsS2V5KTtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGlzLmFkanVzdENhbnZhc1NpemUodGhpcy5maXRNb2RlbFNpemVCeURlZmF1bHQpO1xuICB9XG5cbiAgbmdEb0NoZWNrKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLm1vZGVsKSB7XG4gICAgICBjb25zdCBub2Rlc0NoYW5nZSA9IHRoaXMubm9kZXNEaWZmZXIuZGlmZih0aGlzLm1vZGVsLm5vZGVzKTtcbiAgICAgIGNvbnN0IGVkZ2VzQ2hhbmdlID0gdGhpcy5lZGdlc0RpZmZlci5kaWZmKHRoaXMubW9kZWwuZWRnZXMpO1xuICAgICAgbGV0IG5vZGVzQ2hhbmdlZCA9IGZhbHNlO1xuICAgICAgbGV0IGVkZ2VzQ2hhbmdlZCA9IGZhbHNlO1xuICAgICAgaWYgKG5vZGVzQ2hhbmdlICE9PSBudWxsKSB7XG4gICAgICAgIG5vZGVzQ2hhbmdlLmZvckVhY2hBZGRlZEl0ZW0oKCkgPT4ge1xuICAgICAgICAgIG5vZGVzQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBub2Rlc0NoYW5nZS5mb3JFYWNoUmVtb3ZlZEl0ZW0oKCkgPT4ge1xuICAgICAgICAgIG5vZGVzQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VzQ2hhbmdlICE9PSBudWxsKSB7XG4gICAgICAgIGVkZ2VzQ2hhbmdlLmZvckVhY2hBZGRlZEl0ZW0oKCkgPT4ge1xuICAgICAgICAgIGVkZ2VzQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBlZGdlc0NoYW5nZS5mb3JFYWNoUmVtb3ZlZEl0ZW0oKCkgPT4ge1xuICAgICAgICAgIGVkZ2VzQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGVzQ2hhbmdlZCkge1xuICAgICAgICB0aGlzLmFkanVzdENhbnZhc1NpemUodGhpcy5maXRNb2RlbFNpemVCeURlZmF1bHQpO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGVzQ2hhbmdlZCB8fCBlZGdlc0NoYW5nZWQpIHtcbiAgICAgICAgdGhpcy5kZXRlY3RDaGFuZ2VzU3ViamVjdC5uZXh0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0RWRnZURBdHRyaWJ1dGUoZWRnZTogRmNFZGdlKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lZGdlRHJhd2luZ1NlcnZpY2UuZ2V0RWRnZURBdHRyaWJ1dGUodGhpcy5tb2RlbFNlcnZpY2UuZWRnZXMuc291cmNlQ29vcmQoZWRnZSksXG4gICAgICB0aGlzLm1vZGVsU2VydmljZS5lZGdlcy5kZXN0Q29vcmQoZWRnZSksIHRoaXMuZWRnZVN0eWxlLCB0aGlzLnZlcnRpY2FsZWRnZWVuYWJsZWQpO1xuICB9XG5cbiAgcHVibGljIGFkanVzdENhbnZhc1NpemUoZml0PzogYm9vbGVhbikge1xuICAgIGxldCBtYXhYID0gMDtcbiAgICBsZXQgbWF4WSA9IDA7XG4gICAgY29uc3QgZWxlbWVudCA9ICQodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQpO1xuICAgIHRoaXMubW9kZWwubm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgbWF4WCA9IE1hdGgubWF4KG5vZGUueCArIHRoaXMubm9kZVdpZHRoLCBtYXhYKTtcbiAgICAgIG1heFkgPSBNYXRoLm1heChub2RlLnkgKyB0aGlzLm5vZGVIZWlnaHQsIG1heFkpO1xuICAgIH0pO1xuICAgIGxldCB3aWR0aDtcbiAgICBsZXQgaGVpZ2h0O1xuICAgIGlmIChmaXQpIHtcbiAgICAgIHdpZHRoID0gbWF4WDtcbiAgICAgIGhlaWdodCA9IG1heFk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpZHRoID0gTWF0aC5tYXgobWF4WCwgZWxlbWVudC5wcm9wKCdvZmZzZXRXaWR0aCcpKTtcbiAgICAgIGhlaWdodCA9IE1hdGgubWF4KG1heFksIGVsZW1lbnQucHJvcCgnb2Zmc2V0SGVpZ2h0JykpO1xuICAgIH1cbiAgICBlbGVtZW50LmNzcygnd2lkdGgnLCB3aWR0aCArICdweCcpO1xuICAgIGVsZW1lbnQuY3NzKCdoZWlnaHQnLCBoZWlnaHQgKyAncHgnKTtcbiAgfVxuXG4gIGNhbnZhc0NsaWNrKGV2ZW50OiBNb3VzZUV2ZW50KSB7fVxuXG4gIGVkZ2VNb3VzZURvd24oZXZlbnQ6IE1vdXNlRXZlbnQsIGVkZ2U6IEZjRWRnZSkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG5cbiAgZWRnZUNsaWNrKGV2ZW50OiBNb3VzZUV2ZW50LCBlZGdlOiBGY0VkZ2UpIHtcbiAgICB0aGlzLm1vZGVsU2VydmljZS5lZGdlcy5oYW5kbGVFZGdlTW91c2VDbGljayhlZGdlLCBldmVudC5jdHJsS2V5KTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG5cbiAgZWRnZVJlbW92ZShldmVudDogRXZlbnQsIGVkZ2U6IEZjRWRnZSkge1xuICAgIHRoaXMubW9kZWxTZXJ2aWNlLmVkZ2VzLmRlbGV0ZShlZGdlKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG5cbiAgZWRnZUVkaXQoZXZlbnQ6IEV2ZW50LCBlZGdlOiBGY0VkZ2UpIHtcbiAgICBpZiAodGhpcy51c2VyQ2FsbGJhY2tzLmVkZ2VFZGl0KSB7XG4gICAgICB0aGlzLnVzZXJDYWxsYmFja3MuZWRnZUVkaXQoZXZlbnQsIGVkZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVkZ2VEb3VibGVDbGljayhldmVudDogTW91c2VFdmVudCwgZWRnZTogRmNFZGdlKSB7XG4gICAgaWYgKHRoaXMudXNlckNhbGxiYWNrcy5lZGdlRG91YmxlQ2xpY2spIHtcbiAgICAgIHRoaXMudXNlckNhbGxiYWNrcy5lZGdlRG91YmxlQ2xpY2soZXZlbnQsIGVkZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVkZ2VNb3VzZU92ZXIoZXZlbnQ6IE1vdXNlRXZlbnQsIGVkZ2U6IEZjRWRnZSkge1xuICAgIGlmICh0aGlzLnVzZXJDYWxsYmFja3MuZWRnZU1vdXNlT3Zlcikge1xuICAgICAgdGhpcy51c2VyQ2FsbGJhY2tzLmVkZ2VNb3VzZU92ZXIoZXZlbnQsIGVkZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGVkZ2VNb3VzZUVudGVyKGV2ZW50OiBNb3VzZUV2ZW50LCBlZGdlOiBGY0VkZ2UpIHtcbiAgICB0aGlzLm1vdXNlb3ZlclNlcnZpY2UuZWRnZU1vdXNlRW50ZXIoZXZlbnQsIGVkZ2UpO1xuICB9XG5cbiAgZWRnZU1vdXNlTGVhdmUoZXZlbnQ6IE1vdXNlRXZlbnQsIGVkZ2U6IEZjRWRnZSkge1xuICAgIHRoaXMubW91c2VvdmVyU2VydmljZS5lZGdlTW91c2VMZWF2ZShldmVudCwgZWRnZSk7XG4gIH1cblxuICBASG9zdExpc3RlbmVyKCdkcmFnb3ZlcicsIFsnJGV2ZW50J10pXG4gIGRyYWdvdmVyKGV2ZW50OiBFdmVudCB8IGFueSkge1xuICAgIHRoaXMubm9kZURyYWdnaW5nU2VydmljZS5kcmFnb3ZlcihldmVudCk7XG4gICAgdGhpcy5lZGdlRHJhZ2dpbmdTZXJ2aWNlLmRyYWdvdmVyKGV2ZW50KTtcbiAgfVxuXG4gIEBIb3N0TGlzdGVuZXIoJ2Ryb3AnLCBbJyRldmVudCddKVxuICBkcm9wKGV2ZW50OiBFdmVudCB8IGFueSkge1xuICAgIGlmIChldmVudC5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gICAgaWYgKGV2ZW50LnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgfVxuICAgIHRoaXMubm9kZURyYWdnaW5nU2VydmljZS5kcm9wKGV2ZW50KTtcbiAgfVxuXG4gIEBIb3N0TGlzdGVuZXIoJ21vdXNlZG93bicsIFsnJGV2ZW50J10pXG4gIG1vdXNlZG93bihldmVudDogTW91c2VFdmVudCkge1xuICAgIHRoaXMucmVjdGFuZ2xlU2VsZWN0U2VydmljZS5tb3VzZWRvd24oZXZlbnQpO1xuICB9XG5cbiAgQEhvc3RMaXN0ZW5lcignbW91c2Vtb3ZlJywgWyckZXZlbnQnXSlcbiAgbW91c2Vtb3ZlKGV2ZW50OiBNb3VzZUV2ZW50KSB7XG4gICAgdGhpcy5yZWN0YW5nbGVTZWxlY3RTZXJ2aWNlLm1vdXNlbW92ZShldmVudCk7XG4gIH1cblxuICBASG9zdExpc3RlbmVyKCdtb3VzZXVwJywgWyckZXZlbnQnXSlcbiAgbW91c2V1cChldmVudDogTW91c2VFdmVudCkge1xuICAgIHRoaXMucmVjdGFuZ2xlU2VsZWN0U2VydmljZS5tb3VzZXVwKGV2ZW50KTtcbiAgfVxuXG59XG4iXX0=