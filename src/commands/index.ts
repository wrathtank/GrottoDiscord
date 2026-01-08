import * as verify from './verify';
import * as refresh from './refresh';
import * as unlink from './unlink';
import * as status from './status';
import * as admin from './admin';
import * as ggrotto from './ggrotto';
import * as welcome from './welcome';

export const commands = {
  verify,
  refresh,
  unlink,
  status,
  admin,
  ggrotto,
  welcome,
};

export const commandData = [
  verify.data,
  refresh.data,
  unlink.data,
  status.data,
  admin.data,
  ggrotto.data,
  welcome.data,
];
