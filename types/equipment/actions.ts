export interface ActionResult<T = any> {
  data?: T;
  error?: string;
}