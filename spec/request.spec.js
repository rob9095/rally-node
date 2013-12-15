var should = require('should'),
    rallyRequest = require('../lib/request'),
    request = require('request'),
    sinon = require('sinon'),
    _ = require('lodash');

describe('Request', function() {

    beforeEach(function() {
        this.get = sinon.stub(request, 'get');
        this.put = sinon.stub(request, 'put');
        this.post = sinon.stub(request, 'post');
        this.del = sinon.stub(request, 'del');
    });

    afterEach(function() {
        this.get.restore();
        this.put.restore();
        this.post.restore();
        this.del.restore();
    });

    function createRequest(options) {
        return rallyRequest(_.extend({
            server: 'https://rally1.rallydev.com',
            apiVersion: 'v2.0'
        }, options));
    }

    describe('#constructor', function() {

        it('should initialize the wsapi url correctly', function() {
            createRequest({
                server: 'http://www.acme.com',
                apiVersion: 'v3.0'
            }).wsapiUrl.should.eql('http://www.acme.com/slm/webservice/v3.0')
        });

        it('should pass request options through', function() {
            var defaults = sinon.spy(request, 'defaults');
            var requestOptions = {
                foo: 'bar'
            };
            createRequest({
                requestOptions: requestOptions
            }).httpRequest.should.be.exactly(defaults.firstCall.returnValue);
            defaults.calledWith(requestOptions).should.eql(true);
            defaults.restore();
        });
    });

    describe('#doRequest', function() {

        it('calls the correct request method', function() {
            var rr = createRequest();
            rr.doRequest('get', {foo: 'bar', url: '/someUrl'});
            this.get.calledOnce.should.eql(true);
            var args = this.get.firstCall.args[0];
            args.url.should.eql(rr.wsapiUrl + '/someUrl');
            args.foo.should.eql('bar');
        });

        it('calls back with an error', function(done) {
            var rr = createRequest();
            var error = 'Error!';
            this.get.yieldsAsync(error);
            rr.doRequest('get', {url: '/someUrl'}, function(err, body) {
                err.should.eql([error]);
                should.not.exist(body);
                done();
            });
        });

        it('rejects the promise with an error', function(done) {
            var rr = createRequest();
            var error = 'Error!';
            this.get.yieldsAsync(error);
            var onSuccess = sinon.stub();
            rr.doRequest('get', {url: '/someUrl'}).then(onSuccess, function(err) {
                err.should.eql([error]);
                onSuccess.callCount.should.eql(0);
                done();
            });
        });

        it('calls back with an error on a successful response', function(done) {
            var rr = createRequest();
            var error = 'Error!';
            var responseBody = {Result: {foo: 'bar', Errors: [error], Warnings: []}};
            this.get.yieldsAsync(null, {statusCode: 200}, responseBody);
            rr.doRequest('get', {url: '/someUrl'}, function(err, body) {
                err.should.eql([error]);
                should.not.exist(body);
                done();
            });
        });

        it('rejects the promise with an error on a successful response', function(done) {
            var rr = createRequest();
            var error = 'Error!';
            var responseBody = {Result: {foo: 'bar', Errors: [error], Warnings: []}};
            this.get.yieldsAsync(null, {statusCode: 200}, responseBody);
            var onSuccess = sinon.stub();
            rr.doRequest('get', {url: '/someUrl'}).then(onSuccess, function(err) {
                err.should.eql([error]);
                onSuccess.callCount.should.eql(0);
                done();
            });
        });

        it('calls back with a success', function(done) {
            var rr = createRequest();
            var responseBody = {Result: {foo: 'bar', Errors: [], Warnings: []}};
            this.get.yieldsAsync(null, {statusCode: 200}, responseBody);
            rr.doRequest('get', {url: '/someUrl'}, function(err, body) {
                should.not.exist(err);
                body.should.eql(responseBody.Result);
                done();
            });
        });

        it('resolves the promise with a success', function(done) {
            var rr = createRequest();
            var responseBody = {Result: {foo: 'bar', Errors: [], Warnings: []}};
            this.get.yieldsAsync(null, {statusCode: 200}, responseBody);
            var onError = sinon.stub();
            rr.doRequest('get', {url: '/someUrl'}).then(function(result) {
                result.should.eql(responseBody.Result);
                onError.callCount.should.eql(0);
                done();
            }, onError);
        });

        //todo: test for various other error conditions (status code, empty response, etc.)
    });

    describe('#doSecuredRequest', function() {

        it('requests a security token', function() {
            var rr = createRequest();
            rr.doSecuredRequest('put', {foo: 'bar'});
            this.get.callCount.should.eql(1);
            this.get.firstCall.args[0].should.eql({url: rr.wsapiUrl + '/security/authorize'});
        });

        it('passes along the security token to doRequest and calls back on success', function(done) {
            var rr = createRequest();
            var token = 'a secret token';
            var putResponseBody = {OperationResult: {Errors: [], Warnings: [], Object: {}}};
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [], Warnings: [], SecurityToken: token}});
            this.put.yieldsAsync(null, {statusCode: 200}, putResponseBody);
            var self = this;
            rr.doSecuredRequest('put', {foo: 'bar'}, function(error, result) {
                self.put.callCount.should.eql(1);
                self.put.firstCall.args[0].foo.should.eql('bar');
                self.put.firstCall.args[0].qs.key.should.eql(token);
                putResponseBody.OperationResult.should.eql(result);
                should.not.exist(error);
                done();
            });
        });

        it('passes along the security token to doRequest and resolves the promise on success', function(done) {
            var rr = createRequest();
            var token = 'a secret token';
            var putResponseBody = {OperationResult: {Errors: [], Warnings: [], Object: {}}};
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [], Warnings: [], SecurityToken: token}});
            this.put.yieldsAsync(null, {statusCode: 200}, putResponseBody);
            var onError = sinon.stub();
            var self = this;
            rr.doSecuredRequest('put', {foo: 'bar'}).then(function(result) {
                self.put.callCount.should.eql(1);
                self.put.firstCall.args[0].foo.should.eql('bar');
                self.put.firstCall.args[0].qs.key.should.eql(token);
                putResponseBody.OperationResult.should.eql(result);
                onError.callCount.should.eql(0);
                done();
            }, onError);
        });

        it('rejects the promise on security token failure', function(done) {
            var rr = createRequest();
            var error = 'Some key error';
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [error]}});
            var onSuccess = sinon.stub();
            rr.doSecuredRequest('put', {}).then(onSuccess, function(err) {
                err.should.eql([error]);
                onSuccess.callCount.should.eql(0);
                done();
            });
        });

        it('calls back with error on security token failure', function(done) {
            var rr = createRequest();
            var error = 'Some key error';
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [error]}});
            rr.doSecuredRequest('put', {}, function(err, result) {
                err.should.eql([error]);
                should.not.exist(result);
                done();
            });
        });

        it('rejects the promise on request failure', function(done) {
            var rr = createRequest();
            var error = 'An error';
            var putResponseBody = {OperationResult: {Errors: [error]}};
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [], Warnings: [], SecurityToken: 'foo'}});
            this.put.yieldsAsync(null, {statusCode: 200}, putResponseBody);
            var onSuccess = sinon.stub();
            rr.doSecuredRequest('put', {}).then(onSuccess, function(err) {
                err.should.eql([error]);
                onSuccess.callCount.should.eql(0);
                done();
            });
        });

        it('calls back with error on request failurepasses along the security token to doRequest and resolves the promise on success', function(done) {
            var rr = createRequest();
            var error = 'An error';
            var putResponseBody = {OperationResult: {Errors: [error]}};
            this.get.yieldsAsync(null, {statusCode: 200}, {OperationResult: {Errors: [], Warnings: [], SecurityToken: 'foo'}});
            this.put.yieldsAsync(null, {statusCode: 200}, putResponseBody);
            rr.doSecuredRequest('put', {}, function(err, result) {
                err.should.eql([error]);
                should.not.exist(result);
                done();
            });
        });
    });

    describe('#httpMethods', function() {

        beforeEach(function() {
            this.doRequest = sinon.spy(rallyRequest.Request.prototype, 'doRequest');
            this.doSecuredRequest = sinon.spy(rallyRequest.Request.prototype, 'doSecuredRequest');
        });

        afterEach(function() {
            this.doRequest.restore();
            this.doSecuredRequest.restore();
        });

        it('should get with callback', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var callback = sinon.stub();
            rr.get(options, callback);

            this.doRequest.callCount.should.eql(1);
            this.doRequest.firstCall.args.should.eql(['get', options, callback]);
            this.doSecuredRequest.callCount.should.eql(0);
        });

        it('should get with promise', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var returnValue = rr.get(options);

            this.doRequest.callCount.should.eql(1);
            this.doRequest.firstCall.args.should.eql(['get', options, null]);
            this.doRequest.firstCall.returnValue.should.be.exactly(returnValue);
            this.doSecuredRequest.callCount.should.eql(0);
        });

        it('should post with callback', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var callback = sinon.stub();
            rr.post(options, callback);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['post', options, callback]);
        });

        it('should post with promise', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var returnValue = rr.post(options);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['post', options, null]);
            this.doSecuredRequest.firstCall.returnValue.should.be.exactly(returnValue);
        });

        it('should put with callback', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var callback = sinon.stub();
            rr.put(options, callback);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['put', options, callback]);
        });

        it('should put with promise', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var returnValue = rr.put(options);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['put', options, null]);
            this.doSecuredRequest.firstCall.returnValue.should.be.exactly(returnValue);
        });

        it('should delete with callback', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var callback = sinon.stub();
            rr.delete(options, callback);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['del', options, callback]);
        });

        it('should delete with promise', function() {
            var rr = createRequest();

            var options = {foo: 'bar'};
            var returnValue = rr.delete(options);

            this.doSecuredRequest.callCount.should.eql(1);
            this.doSecuredRequest.firstCall.args.should.eql(['del', options, null]);
            this.doSecuredRequest.firstCall.returnValue.should.be.exactly(returnValue);
        });
    });
});