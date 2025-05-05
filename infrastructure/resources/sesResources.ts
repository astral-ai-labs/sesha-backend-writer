import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

export function setupSesResources() {
  const config = new pulumi.Config();
  const env = config.require('env');
  const email = 'muhammadpen@gmail.com';

  const emailIdentity = new aws.ses.EmailIdentity('email-identity-' + env, {
    email: email,
  });
}
