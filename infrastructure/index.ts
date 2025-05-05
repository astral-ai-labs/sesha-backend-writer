import { setupAuthResources } from './resources/authResources';
import { setupApiResources } from './resources/apiResources';
import { setupWebsocketResources } from './resources/websocketResources';
import { setupStepFunctionResources } from './resources/stepFunctionResources';
import { setupDynamoDbResources } from './resources/dynamoDbResources';
import { setupOpensearchResources } from './resources/opensearchResources';
import { setupVpcResources } from './resources/vpcResources';
import { Output } from '@pulumi/pulumi';

export type VpcInfo = {
  vpcId: Output<string>;
  subnetIds: Output<string>[];
  securityGroupId: Output<string>;
};

const vpcInfo = setupVpcResources();

setupAuthResources();
setupApiResources(vpcInfo);
setupWebsocketResources();
setupStepFunctionResources();
setupDynamoDbResources();
setupOpensearchResources(vpcInfo);
