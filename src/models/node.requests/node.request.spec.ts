import 'reflect-metadata';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { AiXPMessage, AiXPMessageType, AiXPNotificationData, AiXpNotificationType } from '../message';
import { NodeRequestManager } from './node.request.manager';
import { AiXpandCommandAction } from '../pipeline/aixpand.command';
import { UpdateConfigRequest } from './update.config.request';
import { ArchiveConfigRequest } from './archive.config.request';
import { UpdatePipelineInstanceRequest } from './update.pipeline.instance.request';
import { ResponseCodes } from './node.request';

const nodeName = 'test-node';
const pipelinePath = [nodeName, 'pipeline-name', null, null];
const instance1Path = [nodeName, 'pipeline-name', 'SIGNATURE', 'instance-1'];
const instance2Path = [nodeName, 'pipeline-name', 'SIGNATURE', 'instance-2'];
const instance3Path = [nodeName, 'pipeline-name', 'SIGNATURE', 'instance-3'];
const notWatchedPath = [nodeName, 'other-pipeline', null, null];
const onSuccess = jest.fn((message) => message);
const onFail = jest.fn((message) => message);
const makeAiXPNotification = (path, type, code): AiXPMessage<AiXPNotificationData> => {
    return {
        id: '123-123-123-123',
        type: AiXPMessageType.NOTIFICATION,
        path: path,
        time: {
            date: new Date(),
            timezone: {
                utc: null,
                name: null,
            },
        },
        host: {
            id: '123',
            sender: '123',
            totalMessages: 123,
            version: '',
        },
        metadata: {
            executionTimestamp: new Date(),
            message: {
                signature: 'not-important',
                hash: 'not-important',
                format: 'not-important',
            },
        },
        data: {
            module: 'test',
            version: 'test',
            type,
            code,
            tag: 'NOT_IMPORTANT',
            notification: 'DUMMY MESSAGE',
            context: {},
            trace: '',
        },
    };
};

describe('AiXpand Node Request Transactions', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Node Request Manager', () => {
        test('Create pending requests', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath)
                .watch(instance1Path);

            expect(req.isClosed()).toEqual(false);
            expect(req.watches(pipelinePath)).toEqual(true);
            expect(req.watches(instance1Path)).toEqual(true);
            expect(req.watches(notWatchedPath)).toEqual(false);
            expect(req.listWatches()).toEqual([pipelinePath, instance1Path]);
        });

        test('Search pending requests', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath)
                .watch(instance1Path);

            let found = mgr.find(pipelinePath);
            expect(found).toEqual(req);

            found = mgr.find(instance1Path);
            expect(found).toEqual(req);

            found = mgr.find(notWatchedPath);
            expect(found).toEqual(null);
        });

        test('Destroy pending requests', () => {
            const mgr = new NodeRequestManager();
            mgr.create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath)
                .watch(instance1Path);

            mgr.destroy(pipelinePath);

            let found = mgr.find(pipelinePath);
            expect(found).toEqual(null);

            found = mgr.find(instance1Path);
            expect(found).toEqual(null);
        });
    });

    describe('UPDATE_CONFIG messages', () => {
        test('Instantiate UPDATE_CONFIG request', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath)
                .watch(instance1Path);

            expect(req).toBeInstanceOf(UpdateConfigRequest);
        });

        test('Passthrough simple notifications', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath);

            const rejectMethod = jest.spyOn(req as any, 'reject');
            const resolveMethod = jest.spyOn(req as any, 'resolve');

            const notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
            req.process(notification);

            expect(rejectMethod).not.toBeCalled();
            expect(resolveMethod).not.toBeCalled();

            expect(req.isComplete()).toEqual(false);
            expect(req.isClosed()).toEqual(false);
        });

        describe('Rejects: ', () => {
            test('Reject based on EXCEPTION', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath)
                    .watch(instance1Path);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.EXCEPTION, null);
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(false);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });

            test('Reject based on response code: PIPELINE_FAILED', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath)
                    .watch(instance1Path);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_FAILED,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(false);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });

            test('Reject based on response code: PIPELINE_DATA_FAILED', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath)
                    .watch(instance1Path);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_DATA_FAILED,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(false);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });

            test('Reject based on response code: PLUGIN_FAILED even if pipeline executed ok', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath)
                    .watch(instance1Path);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    instance1Path,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PLUGIN_FAILED,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledTimes(2);
                expect(updateTargetMethod).toHaveBeenNthCalledWith(1, pipelinePath, true, 'DUMMY MESSAGE');
                expect(updateTargetMethod).toHaveBeenNthCalledWith(2, instance1Path, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });
        });

        describe('Resolves:', () => {
            test('Resolve based on response code: PIPELINE_OK', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(rejectMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, true, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(resolveMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(true);
                expect(req.isClosed()).toEqual(true);

                expect(onFail).not.toBeCalled();
                expect(onSuccess).toBeCalledWith(returnableNotifs);
            });

            test('Resolve based on response code: PIPELINE_DATA_OK', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_DATA_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(rejectMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, true, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(resolveMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(true);
                expect(req.isClosed()).toEqual(true);

                expect(onFail).not.toBeCalled();
                expect(onSuccess).toBeCalledWith(returnableNotifs);
            });

            test('Resolve based on response code: PLUGIN_OK (if watching instance too)', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.UPDATE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath)
                    .watch(instance1Path);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_DATA_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    instance1Path,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PLUGIN_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(rejectMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(2);
                expect(updateTargetMethod).toHaveBeenNthCalledWith(1, pipelinePath, true, 'DUMMY MESSAGE');
                expect(updateTargetMethod).toHaveBeenNthCalledWith(2, instance1Path, true, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(resolveMethod).toBeCalledTimes(2);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(true);
                expect(req.isClosed()).toEqual(true);

                expect(onFail).not.toBeCalled();
                expect(onSuccess).toBeCalledWith(returnableNotifs);
            });
        });
    });

    describe('ARCHIVE_CONFIG messages', () => {
        test('Instantiate ARCHIVE_CONFIG request', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.ARCHIVE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath);

            expect(req).toBeInstanceOf(ArchiveConfigRequest);
        });

        test('Passthrough if simple notification', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.ARCHIVE_CONFIG }, onSuccess, onFail)
                .watch(pipelinePath);

            const rejectMethod = jest.spyOn(req as any, 'reject');
            const resolveMethod = jest.spyOn(req as any, 'resolve');

            const notification = makeAiXPNotification(
                pipelinePath,
                AiXpNotificationType.NORMAL,
                ResponseCodes.PIPELINE_OK,
            );
            req.process(notification);

            expect(rejectMethod).not.toBeCalled();
            expect(resolveMethod).not.toBeCalled();

            expect(req.isComplete()).toEqual(false);
            expect(req.isClosed()).toEqual(false);
        });

        describe('Rejects:', () => {
            test('Reject based on: EXCEPTION', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.ARCHIVE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.EXCEPTION,
                    ResponseCodes.PIPELINE_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });

            test('Reject based on response code: PIPELINE_ARCHIVE_FAILED', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.ARCHIVE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_ARCHIVE_FAILED,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(resolveMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, false, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(rejectMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(false);
                expect(req.isClosed()).toEqual(true);

                expect(onSuccess).not.toBeCalled();
                expect(onFail).toBeCalledWith(returnableNotifs);
            });
        });

        describe('Resolves', () => {
            test('Resolve based on response code: PIPELINE_ARCHIVE_OK', () => {
                const mgr = new NodeRequestManager();
                const req = mgr
                    .create({ ACTION: AiXpandCommandAction.ARCHIVE_CONFIG }, onSuccess, onFail)
                    .watch(pipelinePath);

                const rejectMethod = jest.spyOn(req as any, 'reject');
                const resolveMethod = jest.spyOn(req as any, 'resolve');
                const closeMethod = jest.spyOn(req as any, 'close');
                const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                const returnableNotifs = [];
                let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                req.process(notification);
                returnableNotifs.push(notification);

                notification = makeAiXPNotification(
                    pipelinePath,
                    AiXpNotificationType.NORMAL,
                    ResponseCodes.PIPELINE_ARCHIVE_OK,
                );
                req.process(notification);
                returnableNotifs.push(notification);

                expect(rejectMethod).not.toBeCalled();
                expect(updateTargetMethod).toBeCalledTimes(1);
                expect(updateTargetMethod).toBeCalledWith(pipelinePath, true, 'DUMMY MESSAGE');
                expect(closeMethod).toBeCalledTimes(1);
                expect(resolveMethod).toBeCalledTimes(1);

                expect(req.isComplete()).toEqual(true);
                expect(req.canResolve()).toEqual(true);
                expect(req.isClosed()).toEqual(true);

                expect(onFail).not.toBeCalled();
                expect(onSuccess).toBeCalledWith(returnableNotifs);
            });
        });
    });

    describe('UPDATE_PIPELINE_INSTANCE messages', () => {
        test('Instantiate UPDATE_PIPELINE_INSTANCE request', () => {
            const mgr = new NodeRequestManager();
            const req = mgr
                .create({ ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE }, onSuccess, onFail)
                .watch(instance1Path);

            expect(req).toBeInstanceOf(UpdatePipelineInstanceRequest);
        });

        describe('Single instance updates', () => {
            describe('Resolves', () => {
                test('Resolve based on response code (1 instance)', () => {
                    const mgr = new NodeRequestManager();
                    const req = mgr
                        .create({ ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE }, onSuccess, onFail)
                        .watch(instance1Path);

                    const rejectMethod = jest.spyOn(req as any, 'reject');
                    const resolveMethod = jest.spyOn(req as any, 'resolve');
                    const closeMethod = jest.spyOn(req as any, 'close');
                    const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                    const returnableNotifs = [];
                    let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance1Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    expect(rejectMethod).not.toBeCalled();
                    expect(updateTargetMethod).toBeCalledTimes(1);
                    expect(updateTargetMethod).toBeCalledWith(instance1Path, true, 'DUMMY MESSAGE');
                    expect(closeMethod).toBeCalledTimes(1);
                    expect(resolveMethod).toBeCalledTimes(1);

                    expect(req.isComplete()).toEqual(true);
                    expect(req.canResolve()).toEqual(true);
                    expect(req.isClosed()).toEqual(true);

                    expect(onFail).not.toBeCalled();
                    expect(onSuccess).toBeCalledWith(returnableNotifs);
                });
            });

            describe('Rejects', () => {
                test('Reject based on response code: PLUGIN_FAILED (1 instance)', () => {
                    const mgr = new NodeRequestManager();
                    const req = mgr
                        .create({ ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE }, onSuccess, onFail)
                        .watch(instance1Path);

                    const rejectMethod = jest.spyOn(req as any, 'reject');
                    const resolveMethod = jest.spyOn(req as any, 'resolve');
                    const closeMethod = jest.spyOn(req as any, 'close');
                    const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                    const returnableNotifs = [];
                    let notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance1Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_FAILED,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    expect(resolveMethod).not.toBeCalled();
                    expect(rejectMethod).toBeCalledTimes(1);
                    expect(updateTargetMethod).toBeCalledTimes(1);
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(1, instance1Path, false, 'DUMMY MESSAGE');
                    expect(closeMethod).toBeCalledTimes(1);

                    expect(req.isComplete()).toEqual(true);
                    expect(req.canResolve()).toEqual(false);
                    expect(req.isClosed()).toEqual(true);

                    expect(onSuccess).not.toBeCalled();
                    expect(onFail).toBeCalledWith(returnableNotifs);
                });
            });
        });

        describe('Batch instance updates', () => {
            describe('Resolves', () => {
                test('Resolve based on response code (3 instances)', () => {
                    const mgr = new NodeRequestManager();
                    const req = mgr
                        .create({ ACTION: AiXpandCommandAction.BATCH_UPDATE_PIPELINE_INSTANCE }, onSuccess, onFail)
                        .watch(instance1Path)
                        .watch(instance2Path)
                        .watch(instance3Path);

                    const rejectMethod = jest.spyOn(req as any, 'reject');
                    const resolveMethod = jest.spyOn(req as any, 'resolve');
                    const closeMethod = jest.spyOn(req as any, 'close');
                    const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                    const returnableNotifs = [];
                    let notification = makeAiXPNotification(
                        instance1Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance2Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance3Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    expect(rejectMethod).not.toBeCalled();
                    expect(updateTargetMethod).toBeCalledTimes(3);
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(1, instance1Path, true, 'DUMMY MESSAGE');
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(2, instance2Path, true, 'DUMMY MESSAGE');
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(3, instance3Path, true, 'DUMMY MESSAGE');
                    expect(closeMethod).toBeCalledTimes(1);
                    expect(resolveMethod).toBeCalledTimes(3);

                    expect(req.isComplete()).toEqual(true);
                    expect(req.canResolve()).toEqual(true);
                    expect(req.isClosed()).toEqual(true);

                    expect(onFail).not.toBeCalled();
                    expect(onSuccess).toBeCalledWith(returnableNotifs);
                });
            });

            describe('Rejects', () => {
                test('Reject based on response code [PLUGIN_OK, PLUGIN_FAILED, PLUGIN_OK] (3 instance)', () => {
                    const mgr = new NodeRequestManager();
                    const req = mgr
                        .create({ ACTION: AiXpandCommandAction.BATCH_UPDATE_PIPELINE_INSTANCE }, onSuccess, onFail)
                        .watch(instance1Path)
                        .watch(instance2Path)
                        .watch(instance3Path);

                    const rejectMethod = jest.spyOn(req as any, 'reject');
                    const resolveMethod = jest.spyOn(req as any, 'resolve');
                    const closeMethod = jest.spyOn(req as any, 'close');
                    const updateTargetMethod = jest.spyOn(req as any, 'updateTarget');

                    const returnableNotifs = [];
                    let notification = makeAiXPNotification(
                        instance1Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance2Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_FAILED,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(pipelinePath, AiXpNotificationType.NORMAL, null);
                    req.process(notification);
                    returnableNotifs.push(notification);

                    notification = makeAiXPNotification(
                        instance3Path,
                        AiXpNotificationType.NORMAL,
                        ResponseCodes.PLUGIN_OK,
                    );
                    req.process(notification);
                    returnableNotifs.push(notification);

                    expect(resolveMethod).toBeCalledTimes(2);
                    expect(rejectMethod).toBeCalledTimes(1);
                    expect(updateTargetMethod).toBeCalledTimes(3);
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(1, instance1Path, true, 'DUMMY MESSAGE');
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(2, instance2Path, false, 'DUMMY MESSAGE');
                    expect(updateTargetMethod).toHaveBeenNthCalledWith(3, instance3Path, true, 'DUMMY MESSAGE');
                    expect(closeMethod).toBeCalledTimes(1);

                    expect(req.isComplete()).toEqual(true);
                    expect(req.canResolve()).toEqual(false);
                    expect(req.isClosed()).toEqual(true);

                    expect(onSuccess).not.toBeCalled();
                    expect(onFail).toBeCalledWith(returnableNotifs);
                });
            });
        });
    });
});
