import * as fs from 'fs';
import { RosaeContextsManager, RosaeContextsManagerParams, UserAndTemplateId } from './RosaeContextsManager';
import { PackagedTemplateWithUser } from './PackagedTemplate';
import { RosaeNlgFeatures } from './RosaeContext';
import uuidv4 from 'uuid/v4';

export class DiskRosaeContextsManager extends RosaeContextsManager {
  private templatesPath: string;

  constructor(
    templatesPath: string,
    rosaeNlgFeatures: RosaeNlgFeatures,
    rosaeContextsManagerParams: RosaeContextsManagerParams,
  ) {
    super(rosaeContextsManagerParams);
    this.templatesPath = templatesPath;
    this.rosaeNlgFeatures = rosaeNlgFeatures;
    console.info({
      action: 'configure',
      message: `templates path is ${this.templatesPath}`,
    });
  }

  public hasBackend(): boolean {
    return true;
  }

  public checkHealth(cb: (err: Error) => void): void {
    const filename = `${this.templatesPath}/health_${uuidv4()}.tmp`;
    const content = 'health check';
    fs.writeFile(filename, content, 'utf8', err => {
      if (err) {
        cb(err);
        return;
      } else {
        fs.unlink(filename, () => {
          cb(null);
          return;
        });
      }
    });
  }

  public getFilename(user: string, templateId: string): string {
    return user + '#' + templateId + '.json';
  }

  protected getAllFiles(cb: (err: Error, files: string[]) => void): void {
    fs.readdir(this.templatesPath, (err, files) => {
      if (err) {
        console.error({
          message: `cannot read disk: ${err}`,
        });
        cb(err, null);
      } else {
        cb(null, files);
      }
    });
  }

  public readTemplateOnBackend(
    user: string,
    templateId: string,
    cb: (err: Error, templateSha1: string, templateContent: PackagedTemplateWithUser) => void,
  ): void {
    const entryKey = this.getFilename(user, templateId);

    fs.readFile(`${this.templatesPath}/${entryKey}`, 'utf8', (err, rawTemplateContent) => {
      if (err) {
        // does not exist: we don't care, don't even log
        const e = new Error();
        e.name = '404';
        e.message = `${entryKey} not found on disk: ${err.message}`;
        cb(e, null, null);
        return;
      } else {
        let parsed: PackagedTemplateWithUser;
        try {
          parsed = JSON.parse(rawTemplateContent);
        } catch (e) {
          const err = new Error();
          err.name = '500';
          err.message = `could not parse: ${e}`;
          cb(err, null, null);
          return;
        }
        cb(null, RosaeContextsManager.getSha1(parsed.src), parsed);
        return;
      }
    });
  }

  protected getUserAndTemplateId(filename: string): UserAndTemplateId {
    return this.getUserAndTemplateIdHelper(filename, '#');
  }

  protected saveOnBackend(filename: string, content: string, cb: (err: Error) => void): void {
    fs.writeFile(`${this.templatesPath}/${filename}`, content, 'utf8', err => {
      cb(err);
    });
  }

  public deleteFromBackend(filename: string, cb: (err: Error) => void): void {
    // delete the file
    const fileToDelete = `${this.templatesPath}/${filename}`;
    fs.unlink(fileToDelete, err => {
      cb(err);
    });
  }
}
