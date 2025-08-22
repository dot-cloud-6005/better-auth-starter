declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => any;
  }
  const initSqlJs: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
