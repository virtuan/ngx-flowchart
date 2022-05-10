import { FcCoords } from './ngx-flowchart.models';
export declare class FcEdgeDrawingService {
    constructor();
    getEdgeDAttribute(pt1: FcCoords, pt2: FcCoords, style: string, verticaledgeenabled: boolean): string;
    getEdgeCenter(pt1: FcCoords, pt2: FcCoords): FcCoords;
    private computeEdgeTangentOffset;
    private computeEdgeSourceTangent;
    private computeEdgeDestinationTangent;
}
