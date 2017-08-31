import { Injectable } from '@angular/core';

declare const AirUpdate: any;

@Injectable()
export class AirUpdateService {

  init(channelCode?: string): Promise<void> {
    return AirUpdate.init(channelCode);
  }

  setChannel(channelCode: string): void {
    return AirUpdate.setChannel(channelCode);
  }

  getLatestServerVersion(): Promise<IAirUpdateVersion> {
    return AirUpdate.getLatestServerVersion();
  }

  getCurrentLocalVersion(): Promise<IAirUpdateVersion> {
    return AirUpdate.getCurrentLocalVersion();
  }

  downloadVersion(version: string): Promise<any> {
    return AirUpdate.downloadVersion(version);
  }

  setupVersion(version: string): Promise<any> {
    return AirUpdate.setupVersion(version);
  }

  getAllLocalVersions(): Promise<string[]> {
    return AirUpdate.getAllLocalVersions();
  }

  deleteLocalVersions(versions: string[]): Promise<void> {
    return AirUpdate.deleteLocalVersions(versions);
  }

  reload(): Promise<void> {
    return AirUpdate.reload();
  }



}


export interface IAirUpdateVersion {
  version: string;
  filesMap: {[file: string]: string};
  extras?: any;
}
